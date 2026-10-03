import awqatData from '../data/awqat.json';
import PrayTimes from '../vendor/awqatPrayTimes.js';

/**
 * Prayer times, Iqamah, Jumu'ah and Hijri offsets published on https://www.awqat.com.au/
 * for each mosque (synced into awqat.json by `npm run awqat:data`).
 */

interface AwqatIqama {
  name: string;
  /** Fixed clock time, "H:MM" */
  fixed?: string;
  /** Minutes after the Adhan */
  after?: number;
}

interface AwqatMosque {
  page: string;
  timetable: string;
  /** Minutes added to Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha */
  adjust: number[];
  iqama: AwqatIqama[] | null;
  hijriOffset: number;
  name: string;
  message: string;
}

interface AwqatTimetable {
  /** Timetable file: "MM-DD" -> Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha in standard-time minutes */
  days?: Record<string, number[]>;
  /** Calculated on the page with PrayTimes.js, in standard time */
  calc?: { lat: number; lng: number; timezone: number; method: string; asr: string };
}

const data = awqatData as unknown as {
  source: string;
  fetched: string;
  cities: Record<string, AwqatTimetable>;
  mosques: Record<string, AwqatMosque>;
};

export const AWQAT_SOURCE = data.source;
export const AWQAT_FETCHED = data.fetched;

export type IqamaPrayer = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

export interface AwqatDay {
  /** Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha as minutes after local midnight */
  times: number[];
  /** Iqamah per prayer, minutes after local midnight */
  iqama: Partial<Record<IqamaPrayer, number>>;
  /** Prayers whose Awqat Iqamah is outside its prayer time (an out-of-season fixed time) */
  iqamaCheck: Partial<Record<IqamaPrayer, true>>;
}

export function hasAwqat(mosqueId: string): boolean {
  return !!data.mosques[mosqueId];
}

export function getAwqatPage(mosqueId: string): string | null {
  return data.mosques[mosqueId]?.page ?? null;
}

/** Offset of `timeZone` from UTC in minutes at the given instant */
const zoneFormatters = new Map<string, Intl.DateTimeFormat>();

function zoneOffsetMinutes(instant: number, timeZone: string): number {
  let formatter = zoneFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    });
    zoneFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Math.round((Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute')) - instant) / 60000);
}

/** Daylight-saving minutes in effect on a calendar day (after the 2–3 am change). */
export function daylightSavingMinutes(year: number, month: number, day: number, timeZone: string): number {
  try {
    const standard = Math.min(
      zoneOffsetMinutes(Date.UTC(year, 0, 1, 12), timeZone),
      zoneOffsetMinutes(Date.UTC(year, 6, 1, 12), timeZone)
    );
    // 02:00 UTC is midday across Australia
    return zoneOffsetMinutes(Date.UTC(year, month - 1, day, 2), timeZone) - standard;
  } catch {
    return 0;
  }
}

/** "1:30" -> minutes, read as the first time at or after `notBefore` - 1h (12-hour entries like "01:30" for Dhuhr) */
function fixedTimeMinutes(value: string, adhan: number): number | null {
  const m = value.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let minutes = Number(m[1]) * 60 + Number(m[2]);
  if (minutes < adhan - 60 && minutes + 720 >= adhan - 60 && minutes < 720) minutes += 720;
  return minutes;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const calculators = new Map<string, PrayTimes>();

/** Fajr…Isha in standard-time minutes from the timetable file or PrayTimes.js */
function standardTimes(table: AwqatTimetable, year: number, month: number, day: number): number[] | null {
  if (table.days) {
    const key = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return table.days[key] ?? table.days['02-28'] ?? null;
  }
  if (!table.calc) return null;
  const { lat, lng, timezone, method, asr } = table.calc;
  const id = `${method}|${asr}`;
  let calculator = calculators.get(id);
  if (!calculator) {
    calculator = new PrayTimes();
    calculator.setMethod(method);
    calculator.adjust({ asr });
    calculators.set(id, calculator);
  }
  // timezone == dst: Awqat's PrayTimes.js then adds no DST hour
  const times = calculator.getTimes([year, month, day], [lat, lng], timezone, timezone, '24h');
  const result = [times.fajr, times.sunrise, times.dhuhr, times.asr, times.maghrib, times.isha].map(toMinutes);
  return result.every(Number.isFinite) ? result : null;
}

/** Awqat's times for a mosque on a calendar day in the mosque's time zone, or null if it isn't on Awqat. */
export function getAwqatDay(mosqueId: string, year: number, month: number, day: number, timeZone: string): AwqatDay | null {
  const mosque = data.mosques[mosqueId];
  const table = mosque && data.cities[mosque.timetable];
  if (!table) return null;
  const standard = standardTimes(table, year, month, day);
  if (!standard) return null;

  const dst = daylightSavingMinutes(year, month, day, timeZone);
  const times = standard.map((t, i) => t + dst + (mosque.adjust[i] ?? 0));

  const iqama: AwqatDay['iqama'] = {};
  const iqamaCheck: AwqatDay['iqamaCheck'] = {};
  const adhanIndex: Record<IqamaPrayer, number> = { Fajr: 0, Dhuhr: 2, Asr: 3, Maghrib: 4, Isha: 5 };
  for (const entry of mosque.iqama ?? []) {
    const name = entry.name as IqamaPrayer;
    const adhan = times[adhanIndex[name]];
    if (adhan === undefined) continue;
    const at = entry.fixed ? fixedTimeMinutes(entry.fixed, adhan) : adhan + (entry.after ?? 0);
    if (at === null || !Number.isFinite(at)) continue;
    // Must fall within the prayer's own time: after its Adhan, before the next one
    // (sunrise for Fajr, midnight for Isha). Otherwise the mosque's fixed time is stale.
    const end = name === 'Isha' ? 24 * 60 : times[adhanIndex[name] + 1];
    if (at < adhan || at >= end) iqamaCheck[name] = true;
    else iqama[name] = at;
  }
  return { times, iqama, iqamaCheck };
}

/** Jumu'ah times from the mosque's Awqat notice, e.g. "12:30PM & 1:15PM", when it gives them. */
export function getAwqatJumuah(mosqueId: string): string | null {
  const message = data.mosques[mosqueId]?.message ?? '';
  if (!/jum/i.test(message)) return null;
  const times = message.replace(/^\s*JUMU.?AH\s*(@|at|:)?\s*/i, '').trim();
  return times || null;
}

/** Days Awqat adds to the arithmetic Hijri calendar for this mosque (+1 on most pages). */
export function getAwqatHijriOffset(mosqueId: string): number | null {
  const mosque = data.mosques[mosqueId];
  return mosque ? mosque.hijriOffset : null;
}
