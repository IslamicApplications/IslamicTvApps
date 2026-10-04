import { existsSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { calculateMosquePrayerTimes, INITIAL_MOSQUES } from '../src/shared/utils/prayerTimes';
import { getPrayerPhase, quranMayContinue, shouldPlayIqamah } from '../src/shared/components/PrayerPhaseOverlay';
import { claimIqamahTrigger, DEFAULT_AZAN_SETTINGS, DUA_IDS, DUA_SOURCES, getDuaForSettings } from '../src/shared/utils/azanAudio';
import { getQuranPosition, resumeStartSeconds, saveQuranPosition } from '../src/shared/utils/quran';
import { importSettingsFromHash } from '../src/tv/importSettings';

const amssa = INITIAL_MOSQUES.find((m) => m.id === 'amssa')!;
// Saturday 3 October 2026 at AMSSA: Maghrib Adhan 6:29 pm, Iqamah 6:34 pm
const day = calculateMosquePrayerTimes(amssa, new Date('2026-10-03T12:00:00+10:00'));
const adhan = day.adhanMinutes.Maghrib;
const iqama = day.iqamaMinutes.Maghrib!;

describe('Iqamah countdown and prayer (TV overlay)', () => {
  it('counts down from the Adhan to the Iqamah, then shows the prayer for its length', () => {
    expect(adhan).toBe(18 * 60 + 29);
    expect(iqama).toBe(18 * 60 + 34);
    expect(getPrayerPhase(day, adhan - 0.5)).toBeNull();
    expect(getPrayerPhase(day, adhan + 1)).toMatchObject({ kind: 'countdown', prayer: 'Maghrib', secondsLeft: 240 });
    expect(getPrayerPhase(day, iqama)).toMatchObject({ kind: 'praying', prayer: 'Maghrib' });
    // Maghrib takes 10 minutes after the Iqamah
    expect(getPrayerPhase(day, iqama + 9.9)?.kind).toBe('praying');
    expect(getPrayerPhase(day, iqama + 10)).toBeNull();
  });

  it('skips a prayer it is told to (Dhuhr on Friday is Jumuah)', () => {
    const dhuhr = day.adhanMinutes.Dhuhr;
    expect(getPrayerPhase(day, dhuhr + 1)?.prayer).toBe('Dhuhr');
    expect(getPrayerPhase(day, dhuhr + 1, (p) => p === 'Dhuhr')).toBeNull();
  });
});

describe('Iqamah sound', () => {
  const settings = { ...DEFAULT_AZAN_SETTINGS };
  const at = (minutes: number) => shouldPlayIqamah(getPrayerPhase(day, minutes), day, minutes, settings);

  it('plays in the first minute after the Iqamah time only', () => {
    expect(at(iqama - 0.1)).toBe(false); // still the countdown
    expect(at(iqama)).toBe(true);
    expect(at(iqama + 0.9)).toBe(true);
    // Switched on later in the prayer: stays quiet
    expect(at(iqama + 1.5)).toBe(false);
    expect(at(iqama + 5)).toBe(false);
  });

  it('is silent with Auto-Azan muted or the Iqamah turned off, and on by default', () => {
    const phase = getPrayerPhase(day, iqama);
    expect(shouldPlayIqamah(phase, day, iqama, { ...settings, autoAzanEnabled: false })).toBe(false);
    expect(shouldPlayIqamah(phase, day, iqama, { ...settings, iqamahSound: false })).toBe(false);
    expect(shouldPlayIqamah(phase, day, iqama, { autoAzanEnabled: true })).toBe(true);
    expect(shouldPlayIqamah(null, day, iqama, settings)).toBe(false);
  });

  it('can be turned off for one prayer', () => {
    const phase = getPrayerPhase(day, iqama);
    expect(shouldPlayIqamah(phase, day, iqama, { ...settings, iqamahPrayers: { Maghrib: false } })).toBe(false);
    expect(shouldPlayIqamah(phase, day, iqama, { ...settings, iqamahPrayers: { Isha: false } })).toBe(true);
  });

  it('plays once per prayer', () => {
    expect(claimIqamahTrigger('2026-10-03_Maghrib')).toBe(true);
    expect(claimIqamahTrigger('2026-10-03_Maghrib')).toBe(false);
    expect(claimIqamahTrigger('2026-10-03_Isha')).toBe(true);
  });
});

describe('Quran after the prayer', () => {
  const key = (minutes: number) => {
    const phase = getPrayerPhase(day, minutes);
    return phase ? `${day.localDateKey}-${phase.prayer}` : null;
  };
  const maghrib = `${day.localDateKey}-Maghrib`;

  it('waits through the countdown, the Iqamah and the prayer, then carries on', () => {
    expect(quranMayContinue(maghrib, key(adhan + 1), false)).toBe(false); // countdown
    expect(quranMayContinue(maghrib, key(iqama), true)).toBe(false); // Iqamah playing
    expect(quranMayContinue(maghrib, key(iqama + 5), false)).toBe(false); // praying
    expect(quranMayContinue(maghrib, key(iqama + 10), false)).toBe(true); // prayer over
    expect(quranMayContinue(maghrib, key(iqama + 10), true)).toBe(false); // an Azan is playing
  });

  it('stays paused after an Azan with no Iqamah countdown (Jumuah)', () => {
    expect(quranMayContinue(null, null, false)).toBe(false);
  });
});

describe('Quran: carrying on from where it stopped', () => {
  const timings = [
    { verse: 1, from: 0, to: 6000 },
    { verse: 2, from: 6000, to: 11000 },
    { verse: 3, from: 11000, to: 16000 }
  ];

  beforeEach(() => localStorage.clear());

  it('remembers the position, and forgets it when told', () => {
    expect(getQuranPosition()).toBeNull();
    saveQuranPosition({ surah: 2, reciter: 7, time: 305.8, verse: 21 });
    expect(getQuranPosition()).toEqual({ surah: 2, reciter: 7, time: 305.8, verse: 21 });
    saveQuranPosition(null);
    expect(getQuranPosition()).toBeNull();
  });

  it('ignores a damaged saved position', () => {
    localStorage.setItem('daily_hadith_tv_quran_position', '{"surah":200,"reciter":7,"time":5,"verse":1}');
    expect(getQuranPosition()).toBeNull();
    localStorage.setItem('daily_hadith_tv_quran_position', 'not json');
    expect(getQuranPosition()).toBeNull();
  });

  it('starts at the saved second, at the same verse with another reciter, or at the beginning', () => {
    const saved = { surah: 2, reciter: 7, time: 8.4, verse: 2 };
    expect(resumeStartSeconds(saved, 2, 7, timings)).toBe(8.4);
    expect(resumeStartSeconds(saved, 2, 3, timings)).toBe(6);
    // Another surah, or nothing saved: from the beginning
    expect(resumeStartSeconds(saved, 3, 7, timings)).toBe(0);
    expect(resumeStartSeconds(null, 2, 7, timings)).toBe(0);
    // Verse not in the timings: the beginning
    expect(resumeStartSeconds({ ...saved, verse: 9 }, 2, 3, timings)).toBe(0);
  });
});

describe('Settings moved over from the old address (#import=…)', () => {
  const hashOf = (settings: unknown) => '#import=' + Buffer.from(JSON.stringify(settings)).toString('base64url');

  it("imports the app's own settings, including Arabic text", () => {
    const stored = new Map<string, string>();
    const storage = { setItem: (k: string, v: string) => void stored.set(k, v) };
    const count = importSettingsFromHash(
      hashOf({
        daily_hadith_selected_mosque_id_v2: 'isv',
        daily_hadith_theme: 'emerald',
        daily_hadith_custom_mosques_v1: '[{"name":"مسجد"}]',
        other_site_key: 'x',
        daily_hadith_bad: 5
      }),
      storage
    );
    expect(count).toBe(3);
    expect(stored.get('daily_hadith_selected_mosque_id_v2')).toBe('isv');
    expect(stored.get('daily_hadith_custom_mosques_v1')).toBe('[{"name":"مسجد"}]');
    expect(stored.has('other_site_key')).toBe(false);
    expect(stored.has('daily_hadith_bad')).toBe(false);
  });

  it('does nothing without settings or with a damaged link', () => {
    const storage = { setItem: () => { throw new Error('should not write'); } };
    expect(importSettingsFromHash('', storage)).toBe(0);
    expect(importSettingsFromHash('#other', storage)).toBe(0);
    expect(importSettingsFromHash('#import=%%%', storage)).toBe(0);
  });
});

describe("Du'a after the Azan recitation", () => {
  it('is Masjid al-Haram unless another is chosen, and falls back from an unknown one', () => {
    expect(DUA_IDS[0]).toBe('makkah');
    expect(getDuaForSettings(DEFAULT_AZAN_SETTINGS)).toBe('makkah');
    expect(getDuaForSettings({ ...DEFAULT_AZAN_SETTINGS, selectedDua: 'removed' as any })).toBe('makkah');
    expect(getDuaForSettings({ ...DEFAULT_AZAN_SETTINGS, selectedDua: 'alafasy' })).toBe('alafasy');
  });

  it('has a recording in public/audio for every recitation', () => {
    for (const id of DUA_IDS) {
      const file = DUA_SOURCES[id].url.split('/').pop()!;
      expect(existsSync(`public/audio/${file}`), file).toBe(true);
    }
  });
});
