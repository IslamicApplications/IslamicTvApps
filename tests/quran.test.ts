import { describe, expect, it } from 'vitest';
import { SURAHS, cleanTranslation, verseAt } from '../src/shared/utils/quran';

describe('quran', () => {
  it('lists all 114 surahs with 6236 verses', () => {
    expect(SURAHS).toHaveLength(114);
    expect(SURAHS.reduce((n, s) => n + s.verses, 0)).toBe(6236);
    expect(SURAHS[8].bismillah).toBe(false);
  });

  it('finds the verse being recited', () => {
    const timings = [
      { verse: 1, from: 0, to: 6000 },
      { verse: 2, from: 6000, to: 11000 },
      { verse: 3, from: 11000, to: 16000 }
    ];
    expect(verseAt(timings, 0)).toBe(0);
    expect(verseAt(timings, 6500)).toBe(1);
    expect(verseAt(timings, 99999)).toBe(2);
  });

  it('removes footnote markers from the translation', () => {
    expect(cleanTranslation('In the name of Allāh,<sup foot_note=195932>1</sup> the Entirely Merciful')).toBe(
      'In the name of Allāh, the Entirely Merciful'
    );
  });
});
