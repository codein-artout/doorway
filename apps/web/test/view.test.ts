import { describe, expect, it } from 'vitest';
import { otherView, resolveView, VIEW_BOOT_SCRIPT } from '../src/lib/view';

describe('Board / Analyst view switch (DESIGN-v2 §1)', () => {
  it('?view= wins, then the stored choice, then Board for a new viewer', () => {
    expect(resolveView('?view=analyst', 'board')).toBe('analyst');
    expect(resolveView('?view=board', 'analyst')).toBe('board');
    expect(resolveView('', 'analyst')).toBe('analyst');
    expect(resolveView('?view=nonsense', null)).toBe('board');
    expect(resolveView('', null)).toBe('board');
    expect(otherView('board')).toBe('analyst');
  });
  it('the boot script forces Analyst on /designer and reads the same storage key', () => {
    expect(VIEW_BOOT_SCRIPT).toContain("indexOf('/designer')===0");
    expect(VIEW_BOOT_SCRIPT).toContain('doorway.view.v2');
  });
});
