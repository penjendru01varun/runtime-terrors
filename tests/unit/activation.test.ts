import { describe, it, expect, vi } from 'vitest';
import { activate, deactivate } from '../../src/extension';
import { MockSecretStorage } from '../mocks/mockVscode';

describe('Extension Activation Lifecycle', () => {
  it('activates extension and registers commands and status bar without throwing', () => {
    const subscriptions: any[] = [];
    const context = {
      subscriptions,
      extensionUri: { fsPath: '/mock/extension', scheme: 'file' },
      secrets: new MockSecretStorage(),
    };

    expect(() => activate(context as any)).not.toThrow();
    expect(subscriptions.length).toBeGreaterThan(0);
  });

  it('deactivates cleanly without throwing', () => {
    expect(() => deactivate()).not.toThrow();
  });
});

