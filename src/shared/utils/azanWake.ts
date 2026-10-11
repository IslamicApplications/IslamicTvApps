import { Mosque, calculateMosquePrayerTimes, mosqueTimeToEpoch } from './prayerTimes';
import { AZAN_PRAYERS, AzanPrayer, AzanSettings } from './azanAudio';

/**
 * "Open for the Azan" in the Android TV app (android/AzanBridge.java). Only a TV running
 * the app has it: elsewhere azanBridge() is null and the setting isn't shown.
 */
export interface AzanBridge {
  /** The coming Azan times (JSON array of AzanAlarm); [] turns the alarm off */
  setAlarms(json: string): void;
  /** JSON {exact, overlay}: the two permissions it needs are allowed */
  status(): string;
  openExactAlarmSettings(): void;
  openOverlaySettings(): void;
  /** The Azan time (epoch ms) the alarm opened the app for, until the prayer is over; 0 otherwise */
  wakePending(): number;
  /** The prayer is over: back to the app that was on before */
  wakeDone(): void;
}

export interface AzanAlarm {
  at: number;
  prayer: AzanPrayer;
}

export interface AzanWakeStatus {
  /** Opens on the minute ("Alarms & reminders" allowed); otherwise up to 10 minutes early */
  exact: boolean;
  /** May open over other apps and from standby ("Display over other apps" allowed) */
  overlay: boolean;
}

export function azanBridge(): AzanBridge | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { IslamicTvAzan?: AzanBridge }).IslamicTvAzan ?? null;
}

export function azanWakeStatus(bridge: AzanBridge): AzanWakeStatus {
  try {
    const status = JSON.parse(bridge.status());
    return { exact: status.exact !== false, overlay: status.overlay !== false };
  } catch {
    return { exact: true, overlay: true };
  }
}

/** Whether the app opens for this prayer's Azan: turned on, the Azan sound on, and the prayer not turned off. */
export function opensForPrayer(settings: AzanSettings, prayer: AzanPrayer): boolean {
  return !!settings.openForAzan && settings.autoAzanEnabled && settings.openForPrayers?.[prayer] !== false;
}

/** How many days of Azan times the app is given (it may be frozen in the background for days) */
export const AZAN_ALARM_DAYS = 7;

/** The coming Azan times (after `now`) of the prayers the app opens for, over the next AZAN_ALARM_DAYS days. */
export function upcomingAzanAlarms(mosque: Mosque, settings: AzanSettings, now: Date = new Date(), days = AZAN_ALARM_DAYS): AzanAlarm[] {
  if (!AZAN_PRAYERS.some((p) => opensForPrayer(settings, p))) return [];
  // Noon at the mosque on each day (never in the hour the clocks change)
  const firstNoon = mosqueTimeToEpoch(mosque, now, 12 * 60);
  const alarms: AzanAlarm[] = [];
  for (let day = 0; day <= days; day++) {
    const noon = new Date(firstNoon + day * 86_400_000);
    const times = calculateMosquePrayerTimes(mosque, noon);
    for (const prayer of AZAN_PRAYERS) {
      if (!opensForPrayer(settings, prayer)) continue;
      const at = mosqueTimeToEpoch(mosque, noon, times.adhanMinutes[prayer]);
      if (at > now.getTime()) alarms.push({ at, prayer });
    }
  }
  return alarms;
}

/** After this long without an Azan, Iqamah or prayer on screen, the app goes back anyway */
const NOTHING_PLAYED_MS = 5 * 60_000;

/**
 * Called every second while the app may have been opened by the alarm. `busy`: the
 * Azan, the Du'a, the Iqamah countdown, the Iqamah or the prayer is on. Once it has
 * been busy and is quiet again (or nothing came within 5 minutes of the Azan time),
 * the app goes back to what was on before. `seen` is kept by the caller between calls.
 */
export function azanWakeStep(bridge: AzanBridge, busy: boolean, now: number, seen: { current: boolean }): void {
  const azanAt = bridge.wakePending();
  if (!azanAt) {
    seen.current = false;
    return;
  }
  if (busy) {
    seen.current = true;
    return;
  }
  if (seen.current || now > azanAt + NOTHING_PLAYED_MS) {
    seen.current = false;
    bridge.wakeDone();
  }
}
