import { ContextEngine } from '../context/contextEngine';
import { trueforgeClientAdapter } from '../trueforge/client';
import { sessionManager } from '../trueforge/sessionManager';
import { turnStreamer } from '../trueforge/turnStreamer';
import { logger } from '../utils/logger';
import { taskPlanner, type AgentTaskState } from './taskPlanner';

export interface AutonomousAgentCallbacks {
  onStateChange: (state: AgentTaskState) => void;
  onDelta?: (delta: string) => void;
  onReasoningDelta?: (delta: string) => void;
  onToolApprovalRequired?: (toolName: string, callId: string) => void;
  onComplete?: (state: AgentTaskState) => void;
  onError?: (err: Error) => void;
}

export class AutonomousAgentCoordinator {
  private isRunning = false;

  public get running(): boolean {
    return this.isRunning;
  }

  public cancel() {
    if (this.isRunning) {
      logger.log('Cancelling autonomous agent execution');
      turnStreamer.cancel();
      taskPlanner.setStatus('cancelled');
      this.isRunning = false;
    }
  }

  public async executeTask(
    goal: string,
    callbacks: AutonomousAgentCallbacks
  ): Promise<AgentTaskState> {
    if (this.isRunning) {
      this.cancel();
    }

    this.isRunning = true;
    const taskState = taskPlanner.initTask(goal);
    callbacks.onStateChange(taskState);

    logger.log(`Executing autonomous agent task: ${goal}`);

    try {
      // 1. Check TrueForge connection
      const conn = await trueforgeClientAdapter.testConnection();
      if (!conn.connected) {
        throw new Error(
          `TrueForge server is unreachable at ${conn.url} (${conn.error || 'Connection failed'}).`
        );
      }

      // 2. Assemble workspace context
      const planningStep = taskState.steps[0];
      const enrichedContext = await ContextEngine.assembleContext(goal);
      if (planningStep) {
        taskPlanner.updateStep(
          planningStep.id,
          'completed',
          `Assembled workspace context (~${enrichedContext.estimatedContextTokens} tokens)`
        );
      }

      taskPlanner.setStatus('executing');
      callbacks.onStateChange(taskPlanner.getState());

      // 3. Obtain TrueForge session
      const client = await trueforgeClientAdapter.getSdkClient();
      const sessionId = await sessionManager.getOrCreateSession();

      const execStep = taskPlanner.addStep('Running TrueForge execution loop');
      callbacks.onStateChange(taskPlanner.getState());

      // 4. Stream turn through TrueForge
      await turnStreamer.streamTurn(client, sessionId, enrichedContext.fullPrompt, {
        onDelta: delta => {
          callbacks.onDelta?.(delta);
        },
        onReasoningDelta: delta => {
          callbacks.onReasoningDelta?.(delta);
        },
        onToolApprovalRequired: (toolName, callId) => {
          taskPlanner.setStatus('waiting_approval');
          taskPlanner.addStep(`Tool approval required: ${toolName}`, toolName);
          callbacks.onStateChange(taskPlanner.getState());
          callbacks.onToolApprovalRequired?.(toolName, callId);
        },
        onTurnComplete: metrics => {
          taskPlanner.updateStep(
            execStep.id,
            'completed',
            `Turn complete (${metrics?.totalTokens ?? 0} tokens)`
          );
          taskPlanner.setStatus('completed');
          callbacks.onStateChange(taskPlanner.getState());
          callbacks.onComplete?.(taskPlanner.getState());
        },
        onError: err => {
          taskPlanner.updateStep(execStep.id, 'failed', err.message);
          taskPlanner.setStatus('failed', err.message);
          callbacks.onStateChange(taskPlanner.getState());
          callbacks.onError?.(err);
        },
      });

      return taskPlanner.getState();
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Autonomous agent execution failed:', error.message);
      taskPlanner.setStatus('failed', error.message);
      callbacks.onStateChange(taskPlanner.getState());
      callbacks.onError?.(error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
}

export const autonomousAgentCoordinator = new AutonomousAgentCoordinator();

