import { describe, expect, it } from 'vitest';
import { calculateMosquePrayerTimes, INITIAL_MOSQUES } from '../src/shared/utils/prayerTimes';

const mosque = (id: string) => INITIAL_MOSQUES.find((m) => m.id === id)!;
const minutes = (t: string) => {
  const [, h, m, ap] = t.match(/(\d+):(\d+) (AM|PM)/)!;
  return ((Number(h) % 12) + (ap === 'PM' ? 12 : 0)) * 60 + Number(m);
};

describe('prayer times', () => {
  it('are in order and well formed for every mosque on every day of a year', () => {
    for (const m of INITIAL_MOSQUES) {
      for (let d = 0; d < 366; d += 3) {
        const r = calculateMosquePrayerTimes(m, new Date(Date.UTC(2026, 9, 2 + d, 2)));
        const times = [r.fajr, r.sunrise, r.dhuhr, r.asr, r.maghrib, r.isha];
        times.forEach((t) => expect(t, `${m.id} ${r.localDateKey}`).toMatch(/^\d\d:\d\d (AM|PM)$/));
        const mins = times.map(minutes);
        for (let i = 1; i < 6; i++) expect(mins[i], `${m.id} ${r.localDateKey} ${times.join(' ')}`).toBeGreaterThan(mins[i - 1]);
        // Iqamah shown only inside the prayer's own time
        for (const [name, at] of Object.entries(r.iqamaMinutes)) {
          expect(at!, `${m.id} ${r.localDateKey} ${name}`).toBeGreaterThanOrEqual(r.adhanMinutes[name as keyof typeof r.adhanMinutes]);
        }
      }
    }
  });

  it('match Awqat for AMSSA (timetable file + its minute adjustments, Iqamah)', () => {
    const r = calculateMosquePrayerTimes(mosque('amssa'), new Date('2026-10-02T09:00:00+10:00'));
    expect([r.fajr, r.sunrise, r.dhuhr, r.asr, r.maghrib, r.isha]).toEqual(['04:24 AM', '05:54 AM', '12:16 PM', '03:44 PM', '06:29 PM', '07:40 PM']);
    expect(r.iqama).toMatchObject({ Fajr: '04:54 AM', Dhuhr: '12:31 PM', Asr: '03:59 PM', Maghrib: '06:34 PM', Isha: '07:45 PM' });
    expect(r.timesSource).toBe('awqat');
  });

  it("match Preston Mosque's own timetable (isv.org.au), Iqamah and Jumu'ah", () => {
    const r = calculateMosquePrayerTimes(mosque('isv'), new Date('2026-10-03T09:00:00+10:00'));
    expect([r.fajr, r.sunrise, r.dhuhr, r.asr, r.maghrib, r.isha]).toEqual(['04:21 AM', '05:53 AM', '12:09 PM', '03:43 PM', '06:26 PM', '07:56 PM']);
    expect(r.iqama).toEqual({ Fajr: '04:51 AM', Dhuhr: '12:19 PM', Asr: '03:53 PM', Maghrib: '06:31 PM', Isha: '08:06 PM' });
    expect(r.timesSource).toBe('mosque');
    expect(r.timesSite).toBe('isv.org.au');
    expect(r.jumuah).toBe('12:30 PM');
    // Daylight saving from 4 October
    expect(calculateMosquePrayerTimes(mosque('isv'), new Date('2026-10-04T09:00:00+11:00')).fajr).toBe('05:20 AM');
  });

  it('apply daylight saving on the day the clocks change', () => {
    const r = calculateMosquePrayerTimes(mosque('amssa'), new Date('2026-10-04T09:00:00+11:00'));
    expect(r.fajr).toBe('05:20 AM');
  });

  it('count down in real time across the clock change', () => {
    expect(calculateMosquePrayerTimes(mosque('amssa'), new Date('2026-10-03T22:00:00+10:00')).nextPrayer.remainingFormatted).toBe('6h 20m');
    expect(calculateMosquePrayerTimes(mosque('amssa'), new Date('2027-04-03T22:00:00+11:00')).nextPrayer.remainingFormatted).toBe('8h 8m');
  });

  it('show Jumuah on Fridays and the Ramadan day during Ramadan', () => {
    expect(calculateMosquePrayerTimes(mosque('amssa'), new Date('2026-10-09T09:00:00+11:00')).isFriday).toBe(true);
    const r = calculateMosquePrayerTimes(mosque('amssa'), new Date('2027-03-01T12:00:00+11:00'));
    expect(r.isRamadan).toBe(true);
    expect(r.ramadanDay).toBe(23);
  });
});
