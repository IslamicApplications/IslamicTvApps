import { describe, expect, it } from 'vitest';
import { shuffledPosition, shownPosition, shownCount } from '../src/shared/utils/hadithLibrary';
import fs from 'node:fs';
import path from 'node:path';

describe('daily Hadith order', () => {
  it('shows every Hadith once before any repeats', () => {
    for (const n of [1, 7, 100, 4567]) {
      const seen = new Set<number>();
      for (let i = 0; i < n; i++) seen.add(shuffledPosition(i, n));
      expect(seen.size).toBe(n);
      expect(Math.max(...seen)).toBeLessThan(n);
    }
  });

  it('never picks a left-out (Daʻif or incomplete) Hadith', () => {
    const index = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/hadith/v3/index.json'), 'utf8'));
    const excluded = new Set<number>(index.excluded);
    const count = shownCount(index);
    for (let rank = 0; rank < count; rank += 97) expect(excluded.has(shownPosition(index, rank))).toBe(false);
    expect(shownPosition(index, count - 1)).toBeLessThan(index.total);
  });
});
