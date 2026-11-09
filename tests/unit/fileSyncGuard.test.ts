import { describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import { FileSyncGuard } from '../../src/bridge/fileSyncGuard';

describe('FileSyncGuard', () => {
  const root = 'C:/Users/hp/Downloads/RuntimeTerrors/runtime-terrors';

  it('allows valid relative paths within workspace', () => {
    const uri = FileSyncGuard.validatePath('src/utils/logger.ts');
    expect(uri.fsPath.replace(/\\/g, '/')).toContain('src/utils/logger.ts');
  });

  it('allows valid absolute paths within workspace', () => {
    const validAbs = `${root}/src/extension.ts`;
    const uri = FileSyncGuard.validatePath(validAbs);
    expect(uri.fsPath.replace(/\\/g, '/')).toContain('src/extension.ts');
  });

  it('blocks path traversal attempts outside workspace', () => {
    expect(() => {
      FileSyncGuard.validatePath('../../Windows/System32/cmd.exe');
    }).toThrow(/Security Error.*outside the workspace boundaries/);

    expect(() => {
      FileSyncGuard.validatePath('../../../secret-folder/passwords.txt');
    }).toThrow(/Security Error.*outside the workspace boundaries/);
  });

  it('blocks sensitive files (.env, keys, credentials)', () => {
    expect(() => {
      FileSyncGuard.validatePath('.env');
    }).toThrow(/Security Error.*sensitive file.*\.env/);

    expect(() => {
      FileSyncGuard.validatePath('.env.production');
    }).toThrow(/Security Error.*sensitive file/);

    expect(() => {
      FileSyncGuard.validatePath('id_rsa');
    }).toThrow(/Security Error.*sensitive file/);

    expect(() => {
      FileSyncGuard.validatePath('server.pem');
    }).toThrow(/Security Error.*sensitive file/);

    expect(() => {
      FileSyncGuard.validatePath('credentials.json');
    }).toThrow(/Security Error.*sensitive file/);
  });

  it('identifies sensitive and non-sensitive files correctly with isSensitive', () => {
    expect(FileSyncGuard.isSensitive('.env')).toBe(true);
    expect(FileSyncGuard.isSensitive('.env.local')).toBe(true);
    expect(FileSyncGuard.isSensitive('id_ed25519')).toBe(true);
    expect(FileSyncGuard.isSensitive('cert.key')).toBe(true);
    expect(FileSyncGuard.isSensitive('credentials.json')).toBe(true);

    expect(FileSyncGuard.isSensitive('package.json')).toBe(false);
    expect(FileSyncGuard.isSensitive('index.ts')).toBe(false);
    expect(FileSyncGuard.isSensitive('README.md')).toBe(false);
  });
});

