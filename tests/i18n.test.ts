import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { toArabicDigits, translate, formatHijri, formatTime } from '../src/shared/i18n';
import { AR } from '../src/shared/i18n.ar';

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(e.name) && e.name !== 'i18n.ar.ts' ? [p] : [];
  });
}

describe('Arabic interface', () => {
  it('has an Arabic translation for every t("…") text in the app', () => {
    const missing = new Set<string>();
    for (const file of sourceFiles(path.join(__dirname, '../src'))) {
      const code = fs.readFileSync(file, 'utf8');
      for (const m of code.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) {
        const key = m[1].replace(/\\'/g, "'");
        if (!(key in AR)) missing.add(`${key}  (${path.basename(file)})`);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('uses Arabic numerals without leading zeros', () => {
    expect(toArabicDigits('04:22')).toBe('٤:٢٢');
    expect(toArabicDigits('12:05 and 100%')).toBe('١٢:٠٥ and ١٠٠٪');
    expect(translate('ar', 'Saved ({count})', { count: 3 })).toBe('المحفوظة (٣)');
  });

  it('translates times and Hijri months', () => {
    expect(formatTime('ar', '04:22 AM')).toBe('04:22 ص');
    expect(formatHijri('ar', '20 Rabiʻ II 1448 AH')).toBe('20 ربيع الآخر 1448 هـ');
    expect(formatHijri('ar', 'Rabiʻ II – Jumada I 1448 AH')).toBe('ربيع الآخر – جمادى الأولى 1448 هـ');
  });
});
