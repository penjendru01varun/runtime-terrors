import { describe, it, expect } from 'vitest';
import { logger } from '../../src/utils/logger';
import { TurnStreamer } from '../../src/trueforge/turnStreamer';
import { activeMockConfiguration } from '../mocks/mockVscode';

describe('Runtime Terrors Chat Message Pipeline Diagnostic', () => {
  it('logs required diagnostics when sending a test message with Gemini model', async () => {
    // Retain user's Gemini model configuration
    const geminiModel = 'google-gemini/gemini-3-5-flash';
    activeMockConfiguration.values.set('defaultModel', geminiModel);

    logger.clearRecentLogs();

    const turnStreamer = new TurnStreamer();

    // Mock an active SSE stream delivering live SSE events followed by turn.done
    const mockEvents = [
      { type: 'model.message.delta', content: 'Hello! I am Runtime Terrors, your AI coding assistant.' },
      { type: 'model.message', usage: { inputTokens: 12, outputTokens: 25 } },
      { type: 'turn.done', state: { status: 'done' } },
    ];

    async function* sseGenerator() {
      for (const ev of mockEvents) {
        yield ev;
      }
    }

    const mockClient = {
      sessions: {
        createTurnStream: async (_sessionId: string, _request: any, _options?: any) => sseGenerator(),
      },
    } as any;

    const deltas: string[] = [];

    // Send the test message
    await turnStreamer.streamTurn(
      mockClient,
      'tf-session-gemini-test',
      'Explain how Runtime Terrors integrates with TrueForge',
      {
        onDelta: d => deltas.push(d),
      },
      geminiModel
    );

    const logs = logger.getRecentLogs();

    console.log('\n--- [Runtime Terrors OutputChannel Content Start] ---');
    for (const line of logs) {
      console.log(line);
    }
    console.log('--- [Runtime Terrors OutputChannel Content End] ---\n');

    // (1) Check: immediately before createTurnStream is invoked, with the session ID and model name
    const preInvocationLog = logs.find(l =>
      l.includes('Invoking createTurnStream: session ID = tf-session-gemini-test, model = google-gemini/gemini-3-5-flash')
    );
    expect(preInvocationLog).toBeDefined();

    // (2) Check: raw event.type of every SSE event received
    const deltaEventLog = logs.find(l => l.includes('Received SSE event: model.message.delta'));
    const messageEventLog = logs.find(l => l.includes('Received SSE event: model.message'));
    const doneEventLog = logs.find(l => l.includes('Received SSE event: turn.done'));

    expect(deltaEventLog).toBeDefined();
    expect(messageEventLog).toBeDefined();
    expect(doneEventLog).toBeDefined();

    // Verify deltas were delivered
    expect(deltas.join('')).toBe('Hello! I am Runtime Terrors, your AI coding assistant.');
  });

  it('logs caught exceptions with full message when SDK fails before or during turn', async () => {
    const geminiModel = 'google-gemini/gemini-3-5-flash';
    logger.clearRecentLogs();

    const turnStreamer = new TurnStreamer();

    const failingClient = {
      sessions: {
        createTurnStream: async () => {
          throw new Error('ECONNREFUSED 127.0.0.1:8790: TrueForge server unreachable');
        },
      },
    } as any;

    let caughtErr: Error | null = null;
    try {
      await turnStreamer.streamTurn(
        failingClient,
        'sess-failed',
        'Test message',
        {},
        geminiModel
      );
    } catch (err: any) {
      caughtErr = err;
    }

    expect(caughtErr).not.toBeNull();

    const logs = logger.getRecentLogs();
    console.log('\n--- [Runtime Terrors OutputChannel Error Content Start] ---');
    for (const line of logs) {
      console.log(line);
    }
    console.log('--- [Runtime Terrors OutputChannel Error Content End] ---\n');

    // (3) Check: any caught exception with its full message
    const exceptionLog = logs.find(l =>
      l.includes('Caught exception: ECONNREFUSED 127.0.0.1:8790: TrueForge server unreachable')
    );
    expect(exceptionLog).toBeDefined();
  });
});

