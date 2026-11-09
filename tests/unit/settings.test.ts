import { describe, it, expect, beforeEach } from 'vitest';
import { SettingsManager } from '../../src/config/settings';
import { MockSecretStorage, activeMockConfiguration } from '../mocks/mockVscode';

describe('SettingsManager', () => {
  let settings: SettingsManager;
  let mockSecrets: MockSecretStorage;

  beforeEach(() => {
    mockSecrets = new MockSecretStorage();
    activeMockConfiguration.values.set('trueforgeUrl', 'http://127.0.0.1:8790');
    activeMockConfiguration.values.set('defaultModel', 'openai/gpt-4o');

    settings = new SettingsManager();
    settings.init({ secrets: mockSecrets } as any);
  });

  it('retrieves default TrueForge URL and trims trailing slashes', () => {
    expect(settings.getTrueForgeUrl()).toBe('http://127.0.0.1:8790');
  });

  it('updates TrueForge URL', async () => {
    await settings.setTrueForgeUrl('http://custom-host:8000/');
    expect(activeMockConfiguration.get('trueforgeUrl')).toBe('http://custom-host:8000');
  });

  it('stores and retrieves API token in SecretStorage', async () => {
    expect(await settings.hasApiToken()).toBe(false);

    await settings.setApiToken('my-test-secret-token');
    expect(await settings.hasApiToken()).toBe(true);
    expect(await settings.getApiToken()).toBe('my-test-secret-token');

    // Test clearing token
    await settings.setApiToken('');
    expect(await settings.hasApiToken()).toBe(false);
  });
});
