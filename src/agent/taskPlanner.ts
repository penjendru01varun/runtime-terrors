export type AgentTaskStatus =
  | 'idle'
  | 'planning'
  | 'executing'
  | 'waiting_approval'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface AgentStep {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  details?: string;
  toolName?: string;
  timestamp: string;
}

export interface AgentTaskState {
  taskId: string;
  goal: string;
  status: AgentTaskStatus;
  steps: AgentStep[];
  error?: string;
  windowsSandboxNotice?: string;
}

export class TaskPlanner {
  private currentState: AgentTaskState = {
    taskId: '',
    goal: '',
    status: 'idle',
    steps: [],
  };

  public getState(): AgentTaskState {
    return { ...this.currentState };
  }

  public initTask(goal: string): AgentTaskState {
    this.currentState = {
      taskId: 'task-' + Date.now(),
      goal,
      status: 'planning',
      steps: [
        {
          id: 'step-plan',
          title: 'Planning agent task execution via TrueForge',
          status: 'running',
          timestamp: new Date().toISOString(),
        },
      ],
      // Explicitly document the Windows limitation discovered in TrueForge
      windowsSandboxNotice:
        process.platform === 'win32'
          ? 'TrueForge LocalSandboxProvider supports macOS and Linux only (win32 detected). Tool executions operate without host-level Linux sandboxing.'
          : undefined,
    };
    return this.getState();
  }

  public addStep(title: string, toolName?: string): AgentStep {
    const step: AgentStep = {
      id: 'step-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      title,
      status: 'running',
      toolName,
      timestamp: new Date().toISOString(),
    };
    this.currentState.steps.push(step);
    return step;
  }

  public updateStep(stepId: string, status: AgentStep['status'], details?: string) {
    const step = this.currentState.steps.find(s => s.id === stepId);
    if (step) {
      step.status = status;
      if (details) step.details = details;
    }
  }

  public setStatus(status: AgentTaskStatus, error?: string) {
    this.currentState.status = status;
    if (error) {
      this.currentState.error = error;
    }
  }
}

export const taskPlanner = new TaskPlanner();

