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
  it('the boot script remembers a ?view= link outside /designer', () => {
    const store: Record<string, string> = {};
    const html = {
      attrs: {} as Record<string, string>,
      setAttribute(k: string, v: string) {
        this.attrs[k] = v;
      },
    };
    const run = (pathname: string, search: string) =>
      new Function('location', 'localStorage', 'document', VIEW_BOOT_SCRIPT)(
        { pathname, search },
        { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v) },
        { documentElement: html },
      );
    run('/', '?view=analyst');
    expect(store['doorway.view.v2']).toBe('analyst');
    run('/play', '');
    expect(html.attrs['data-view']).toBe('analyst');
    run('/designer', '?view=board');
    expect(html.attrs['data-view']).toBe('analyst');
    expect(store['doorway.view.v2']).toBe('analyst');
  });
});
