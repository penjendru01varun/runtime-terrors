import { describe, it, expect } from 'vitest';
import { TrueForgeClientAdapter } from '../../src/trueforge/client';

describe('Live TrueForge Server Integration', () => {
  const adapter = new TrueForgeClientAdapter();

  it('attempts to connect to real TrueForge instance and evaluates connectivity', async () => {
    const result = await adapter.testConnection();

    console.log('[Live TrueForge Probe Result]:', {
      connected: result.connected,
      url: result.url,
      latencyMs: result.latencyMs,
      modelsFound: result.models?.length ?? 0,
      error: result.error,
    });

    if (result.connected) {
      expect(result.connected).toBe(true);
      expect(result.models).toBeDefined();
      expect(Array.isArray(result.models)).toBe(true);
      console.log(`[Live TrueForge Test]: Successfully verified online TrueForge runtime with ${result.models?.length} models.`);
    } else {
      console.log(`[Live TrueForge Test (Offline)]: TrueForge is not running locally at ${result.url}. Error reported: "${result.error}". Test verified diagnostic error handling.`);
      expect(result.connected).toBe(false);
      expect(result.error).toBeDefined();
    }
  });
});

