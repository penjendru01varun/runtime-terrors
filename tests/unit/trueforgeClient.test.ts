import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TrueForgeClientAdapter } from '../../src/trueforge/client';
import { settingsManager } from '../../src/config/settings';

describe('TrueForgeClientAdapter', () => {
  let adapter: TrueForgeClientAdapter;

  beforeEach(() => {
    adapter = new TrueForgeClientAdapter();
    vi.spyOn(settingsManager, 'getTrueForgeUrl').mockReturnValue('http://127.0.0.1:8790');
    vi.spyOn(settingsManager, 'getApiToken').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports connected: true when TrueForge server returns 200 with models', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { name: 'openai/gpt-4o' },
          { name: 'anthropic/claude-3-7-sonnet' },
        ],
      }),
    } as any);

    const result = await adapter.testConnection();
    expect(result.connected).toBe(true);
    expect(result.url).toBe('http://127.0.0.1:8790');
    expect(result.models).toEqual(['openai/gpt-4o', 'anthropic/claude-3-7-sonnet']);
    expect(result.latencyMs).toBeTypeOf('number');
  });

  it('reports connected: false with clear message on 401 Unauthorized', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    } as any);

    const result = await adapter.testConnection();
    expect(result.connected).toBe(false);
    expect(result.error).toContain('Authentication failed (HTTP 401)');
  });

  it('reports connected: false with offline hint on connection error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('fetch failed: connect ECONNREFUSED 127.0.0.1:8790'));

    const result = await adapter.testConnection();
    expect(result.connected).toBe(false);
    expect(result.error).toContain('Could not reach TrueForge server');
  });
});

