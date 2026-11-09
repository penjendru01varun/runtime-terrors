import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TurnStreamer } from '../../src/trueforge/turnStreamer';

describe('TurnStreamer', () => {
  let turnStreamer: TurnStreamer;

  beforeEach(() => {
    turnStreamer = new TurnStreamer();
  });

  it('streams deltas, reasoning, and handles turn completion', async () => {
    const mockEvents = [
      { type: 'model.message.delta', content: 'Hello ', reasoningContent: 'Thinking step 1.' },
      { type: 'model.message.delta', content: 'World!', reasoningContent: ' Thinking step 2.' },
      { type: 'model.message', usage: { totalTokens: 42 } },
      { type: 'turn.done' },
    ];

    async function* eventGenerator() {
      for (const ev of mockEvents) {
        yield ev;
      }
    }

    const mockClient = {
      sessions: {
        createTurnStream: vi.fn().mockResolvedValue(eventGenerator()),
      },
    } as any;

    const deltas: string[] = [];
    const reasoningDeltas: string[] = [];
    let completedMetrics: any = null;

    await turnStreamer.streamTurn(mockClient, 'sess-123', 'Hi', {
      onDelta: d => deltas.push(d),
      onReasoningDelta: r => reasoningDeltas.push(r),
      onTurnComplete: m => {
        completedMetrics = m;
      },
    });

    expect(deltas).toEqual(['Hello ', 'World!']);
    expect(reasoningDeltas).toEqual(['Thinking step 1.', ' Thinking step 2.']);
    expect(completedMetrics).toEqual({ totalTokens: 42 });
    expect(turnStreamer.streaming).toBe(false);
  });

  it('handles tool.approval_required events', async () => {
    const mockEvents = [
      {
        type: 'tool.approval_required',
        id: 'evt-app-1',
        toolCalls: [{ id: 'call-1', name: 'propose_file_change' }],
      },
      { type: 'turn.done' },
    ];

    async function* eventGenerator() {
      for (const ev of mockEvents) {
        yield ev;
      }
    }

    const mockClient = {
      sessions: {
        createTurnStream: vi.fn().mockResolvedValue(eventGenerator()),
      },
    } as any;

    let toolApprovalReceived = '';

    await turnStreamer.streamTurn(mockClient, 'sess-123', 'Modify file', {
      onToolApprovalRequired: (name, id) => {
        toolApprovalReceived = `${name}:${id}`;
      },
    });

    expect(toolApprovalReceived).toBe('propose_file_change:call-1');
  });

  it('aborts active stream cleanly when cancel() is called', async () => {
    let loopCount = 0;
    async function* slowEventGenerator() {
      while (true) {
        loopCount++;
        yield { type: 'model.message.delta', content: 'chunk' };
        await new Promise(r => setTimeout(r, 10));
      }
    }

    const mockClient = {
      sessions: {
        createTurnStream: vi.fn().mockResolvedValue(slowEventGenerator()),
      },
    } as any;

    const streamPromise = turnStreamer.streamTurn(mockClient, 'sess-123', 'Loop forever', {});

    setTimeout(() => {
      turnStreamer.cancel();
    }, 25);

    await streamPromise;
    expect(turnStreamer.streaming).toBe(false);
    expect(loopCount).toBeGreaterThan(0);
  });

  it('extracts full response text from model.message when no deltas were sent', async () => {
    const mockEvents = [
      {
        type: 'model.message',
        content: 'This is the complete assistant response from Gemini.',
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      { type: 'turn.done', state: { status: 'done' } },
    ];

    async function* eventGenerator() {
      for (const ev of mockEvents) {
        yield ev;
      }
    }

    const mockClient = {
      sessions: {
        createTurnStream: vi.fn().mockResolvedValue(eventGenerator()),
      },
    } as any;

    const deltas: string[] = [];
    let completedMetrics: any = null;

    await turnStreamer.streamTurn(mockClient, 'sess-gemini', 'Hello', {
      onDelta: d => deltas.push(d),
      onTurnComplete: m => {
        completedMetrics = m;
      },
    });

    expect(deltas).toEqual(['This is the complete assistant response from Gemini.']);
    expect(completedMetrics).toEqual({ totalTokens: 30 });
  });

  it('handles structured array content in model.message', async () => {
    const mockEvents = [
      {
        type: 'model.message',
        content: [
          { type: 'text', text: 'Part 1. ' },
          { type: 'text', text: 'Part 2.' },
        ],
        usage: { inputTokens: 5, outputTokens: 15 },
      },
      { type: 'turn.done', state: { status: 'done' } },
    ];

    async function* eventGenerator() {
      for (const ev of mockEvents) {
        yield ev;
      }
    }

    const mockClient = {
      sessions: {
        createTurnStream: vi.fn().mockResolvedValue(eventGenerator()),
      },
    } as any;

    const deltas: string[] = [];
    await turnStreamer.streamTurn(mockClient, 'sess-gemini-parts', 'Hello', {
      onDelta: d => deltas.push(d),
    });

    expect(deltas).toEqual(['Part 1. Part 2.']);
  });

  it('propagates error when turn.done arrives with error state', async () => {
    const mockEvents = [
      {
        type: 'turn.done',
        state: {
          status: 'error',
          message: 'Model google-gemini/gemini-3-5-flash quota exceeded',
        },
      },
    ];

    async function* eventGenerator() {
      for (const ev of mockEvents) {
        yield ev;
      }
    }

    const mockClient = {
      sessions: {
        createTurnStream: vi.fn().mockResolvedValue(eventGenerator()),
      },
    } as any;

    let receivedError: Error | null = null;

    await expect(
      turnStreamer.streamTurn(mockClient, 'sess-err', 'Hi', {
        onError: err => {
          receivedError = err;
        },
      })
    ).rejects.toThrow('Model google-gemini/gemini-3-5-flash quota exceeded');

    expect(receivedError).not.toBeNull();
    expect(receivedError?.message).toContain('quota exceeded');
  });

  it('handles turn.done with cancelled state gracefully', async () => {
    const mockEvents = [
      {
        type: 'turn.done',
        state: {
          status: 'cancelled',
          reason: 'client_request',
        },
      },
    ];

    async function* eventGenerator() {
      for (const ev of mockEvents) {
        yield ev;
      }
    }

    const mockClient = {
      sessions: {
        createTurnStream: vi.fn().mockResolvedValue(eventGenerator()),
      },
    } as any;

    let receivedError: Error | null = null;

    await turnStreamer.streamTurn(mockClient, 'sess-cancel', 'Hi', {
      onError: err => {
        receivedError = err;
      },
    });

    expect(receivedError?.message).toContain('Turn cancelled: client_request');
  });
});

