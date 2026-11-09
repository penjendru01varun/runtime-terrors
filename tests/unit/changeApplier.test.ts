import { beforeEach, describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import { changeApplier } from '../../src/diff/changeApplier';

describe('ChangeApplier', () => {
  const testUri = vscode.Uri.file('C:/Users/hp/Downloads/RuntimeTerrors/runtime-terrors/src/sample.ts');

  beforeEach(() => {
    changeApplier.clearHistory();
  });

  it('starts with an empty rollback stack and canUndo false', () => {
    expect(changeApplier.canUndo()).toBe(false);
    expect(changeApplier.getRollbackStack()).toHaveLength(0);
  });

  it('applies file changes, saves rollback history, and sets canUndo to true', async () => {
    const newContent = 'function hello() {\n  return "universe";\n}\n';
    const applied = await changeApplier.applyFileChanges(
      testUri as any,
      newContent,
      'Update greeting to universe'
    );

    expect(applied).toBe(true);
    expect(changeApplier.canUndo()).toBe(true);
    const stack = changeApplier.getRollbackStack();
    expect(stack).toHaveLength(1);
    expect(stack[0].appliedContent).toBe(newContent);
    expect(stack[0].description).toBe('Update greeting to universe');
  });

  it('reverts the last change when undoLastChange is invoked', async () => {
    const newContent = 'const x = 42;\n';
    await changeApplier.applyFileChanges(testUri as any, newContent, 'First change');

    expect(changeApplier.canUndo()).toBe(true);

    const undone = await changeApplier.undoLastChange();
    expect(undone).not.toBeNull();
    expect(undone?.appliedContent).toBe(newContent);
    expect(changeApplier.canUndo()).toBe(false);
  });

  it('returns null when undoLastChange is called on an empty stack', async () => {
    const undone = await changeApplier.undoLastChange();
    expect(undone).toBeNull();
  });
});

