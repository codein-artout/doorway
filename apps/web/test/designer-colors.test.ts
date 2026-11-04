import { describe, expect, it } from 'vitest';
import { contrast, lightDiverging } from '../src/lib/designer-colors';

const rgb = (s: string) => s.match(/\d+/g)!.map(Number);
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

describe('designer head-to-head colours on the Analyst sheet', () => {
  it('every cell value keeps its number at ≥ 4.5:1', () => {
    for (let v = 0; v <= 1.0001; v += 0.01) {
      const c = lightDiverging(v, 0.5, 0.35);
      expect(contrast(rgb(c.bg), hex(c.fg))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
