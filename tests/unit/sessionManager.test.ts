import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager } from '../../src/trueforge/sessionManager';
import { trueforgeClientAdapter } from '../../src/trueforge/client';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockClient: any;

  beforeEach(() => {
    sessionManager = new SessionManager();
    mockClient = {
      sessions: {
        create: vi.fn().mockResolvedValue({ data: { id: 'tf-session-123' } }),
        cancel: vi.fn().mockResolvedValue({}),
        list: vi.fn().mockResolvedValue([
          {
            sessionId: 'sess-1',
            title: 'Test Session',
            createdAt: '2026-11-09T00:00:00Z',
            agentSpec: { model: { name: 'openai/gpt-4o' } },
          },
        ]),
      },
    };
    vi.spyOn(trueforgeClientAdapter, 'getSdkClient').mockResolvedValue(mockClient);
  });

  it('creates a new session with TrueForge SDK', async () => {
    const sessionId = await sessionManager.getOrCreateSession('openai/gpt-4o');
    expect(sessionId).toBe('tf-session-123');
    expect(mockClient.sessions.create).toHaveBeenCalledTimes(1);
    expect(mockClient.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: expect.objectContaining({
          spec: expect.objectContaining({
            model: { name: 'openai/gpt-4o' },
          }),
        }),
      })
    );
  });

  it('reuses the existing active session when the model is the same', async () => {
    await sessionManager.getOrCreateSession('openai/gpt-4o');
    const secondCall = await sessionManager.getOrCreateSession('openai/gpt-4o');
    expect(secondCall).toBe('tf-session-123');
    expect(mockClient.sessions.create).toHaveBeenCalledTimes(1);
  });

  it('creates a new session after resetSession() is called', async () => {
    await sessionManager.getOrCreateSession('openai/gpt-4o');
    sessionManager.resetSession();
    expect(sessionManager.getActiveSessionId()).toBeUndefined();

    await sessionManager.getOrCreateSession('openai/gpt-4o');
    expect(mockClient.sessions.create).toHaveBeenCalledTimes(2);
  });

  it('dispatches cancellation to TrueForge server', async () => {
    await sessionManager.getOrCreateSession('openai/gpt-4o');
    await sessionManager.cancelActiveSession();
    expect(mockClient.sessions.cancel).toHaveBeenCalledWith('tf-session-123');
  });
});
