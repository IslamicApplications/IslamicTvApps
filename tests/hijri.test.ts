import { describe, expect, it } from 'vitest';
import { getHijriDate } from '../src/shared/utils/hijri';

describe('Hijri calendar (as on Awqat)', () => {
  it('matches Awqat for AMSSA (+1 day)', () => {
    expect(getHijriDate(new Date(2026, 9, 2), 1).formatted).toBe('20 Rabiʻ II 1448 AH');
  });

  it('never skips or repeats a day over three years', () => {
    let prev = getHijriDate(new Date(2026, 0, 1), 1);
    for (let i = 1; i < 1100; i++) {
      const h = getHijriDate(new Date(2026, 0, 1 + i), 1);
      const next = (h.day === prev.day + 1 && h.month === prev.month) || (h.day === 1 && (prev.day === 29 || prev.day === 30));
      expect(next, `${prev.formatted} -> ${h.formatted}`).toBe(true);
      prev = h;
    }
  });
});
