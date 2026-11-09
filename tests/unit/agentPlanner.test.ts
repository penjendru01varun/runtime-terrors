import { describe, it, expect, beforeEach } from 'vitest';
import { TaskPlanner } from '../../src/agent/taskPlanner';

describe('TaskPlanner & Agent Mode State', () => {
  let planner: TaskPlanner;

  beforeEach(() => {
    planner = new TaskPlanner();
  });

  it('initializes agent task and records Windows sandbox limitation on win32', () => {
    const state = planner.initTask('Optimize database queries');
    expect(state.goal).toBe('Optimize database queries');
    expect(state.status).toBe('planning');
    expect(state.steps.length).toBe(1);

    if (process.platform === 'win32') {
      expect(state.windowsSandboxNotice).toContain('supports macOS and Linux only (win32 detected)');
    }
  });

  it('adds and updates steps throughout task progression', () => {
    planner.initTask('Audit dependencies');
    const step = planner.addStep('Inspecting package.json', 'read_file');
    expect(step.status).toBe('running');
    expect(step.toolName).toBe('read_file');

    planner.updateStep(step.id, 'completed', 'Read 45 dependencies');
    const updated = planner.getState().steps.find(s => s.id === step.id);
    expect(updated?.status).toBe('completed');
    expect(updated?.details).toBe('Read 45 dependencies');
  });

  it('transitions state to completed and failed with error messages', () => {
    planner.initTask('Test error flow');
    planner.setStatus('failed', 'TrueForge connection timeout');
    const state = planner.getState();
    expect(state.status).toBe('failed');
    expect(state.error).toBe('TrueForge connection timeout');
  });
});

