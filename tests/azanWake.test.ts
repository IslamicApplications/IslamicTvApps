import { describe, expect, it } from 'vitest';
import { calculateMosquePrayerTimes, INITIAL_MOSQUES, mosqueTimeToEpoch } from '../src/shared/utils/prayerTimes';
import { DEFAULT_AZAN_SETTINGS } from '../src/shared/utils/azanAudio';
import { azanWakeStep, upcomingAzanAlarms, type AzanBridge } from '../src/shared/utils/azanWake';

const amssa = INITIAL_MOSQUES.find((m) => m.id === 'amssa')!;
const on = { ...DEFAULT_AZAN_SETTINGS, openForAzan: true };

describe('Open for the Azan (Android TV alarms)', () => {
  it('turns a time at the mosque into the moment, also across the night the clocks change', () => {
    // Sydney: AEST (+10) until Sunday 4 October 2026 at 2 am, AEDT (+11) after
    expect(mosqueTimeToEpoch(amssa, new Date('2026-10-03T12:00:00+10:00'), 18 * 60 + 29)).toBe(Date.parse('2026-10-03T18:29:00+10:00'));
    expect(mosqueTimeToEpoch(amssa, new Date('2026-10-04T12:00:00+11:00'), 5 * 60)).toBe(Date.parse('2026-10-04T05:00:00+11:00'));
    // Late at night the day before is still that day
    expect(mosqueTimeToEpoch(amssa, new Date('2026-10-03T23:59:00+10:00'), 60)).toBe(Date.parse('2026-10-03T01:00:00+10:00'));
  });

  it('is off unless turned on, and off with the Azan sound off', () => {
    const now = new Date('2026-10-03T12:00:00+10:00');
    expect(upcomingAzanAlarms(amssa, DEFAULT_AZAN_SETTINGS, now)).toEqual([]);
    expect(upcomingAzanAlarms(amssa, { ...on, autoAzanEnabled: false }, now)).toEqual([]);
  });

  it('gives the coming week of Azan times, at the times on the screen', () => {
    const now = new Date('2026-10-03T13:00:00+10:00');
    const alarms = upcomingAzanAlarms(amssa, on, now);
    // Today's Asr, Maghrib and Isha (Fajr and Dhuhr have passed), then five a day
    expect(alarms.slice(0, 3).map((a) => a.prayer)).toEqual(['Asr', 'Maghrib', 'Isha']);
    expect(alarms.length).toBe(3 + 7 * 5);
    expect(alarms.every((a, i) => a.at > now.getTime() && (i === 0 || a.at > alarms[i - 1].at))).toBe(true);
    expect(alarms[1].at).toBe(Date.parse('2026-10-03T18:29:00+10:00'));
    // Across the clock change, tomorrow's Fajr is at the Fajr shown tomorrow (in AEDT)
    const tomorrow = calculateMosquePrayerTimes(amssa, new Date('2026-10-04T12:00:00+11:00'));
    const fajr = alarms.find((a) => a.prayer === 'Fajr')!;
    const [h, m] = tomorrow.fajr24.split(':').map(Number);
    expect(fajr.at).toBe(Date.parse(`2026-10-04T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+11:00`));
  });

  it('leaves out the prayers turned off', () => {
    const alarms = upcomingAzanAlarms(amssa, { ...on, openForPrayers: { Fajr: false, Isha: false } }, new Date('2026-10-03T13:00:00+10:00'));
    expect(alarms.some((a) => a.prayer === 'Fajr' || a.prayer === 'Isha')).toBe(false);
    expect(alarms.filter((a) => a.prayer === 'Dhuhr').length).toBe(7);
  });

  it('goes back once the Azan, Iqamah and prayer are over, or if nothing came', () => {
    let pending = 1_000_000;
    let done = 0;
    const bridge = { wakePending: () => pending, wakeDone: () => { done++; pending = 0; } } as unknown as AzanBridge;
    const seen = { current: false };
    // Opened 45 s early: nothing on yet, stays
    azanWakeStep(bridge, false, pending - 45_000, seen);
    expect(done).toBe(0);
    azanWakeStep(bridge, true, pending + 1_000, seen);
    azanWakeStep(bridge, true, pending + 600_000, seen);
    expect(done).toBe(0);
    azanWakeStep(bridge, false, pending + 1_200_000, seen);
    expect(done).toBe(1);

    // The Azan never played (e.g. turned off since): back after 5 minutes
    pending = 1_000_000;
    azanWakeStep(bridge, false, pending + 60_000, seen);
    expect(done).toBe(1);
    azanWakeStep(bridge, false, pending + 301_000, seen);
    expect(done).toBe(2);
  });
});
