import mosquesData from '../data/mosques.json';
import { getHijriDate } from './hijri';
import { getAwqatDay, getAwqatJumuah, IqamaPrayer } from './awqat';
import { getTimetableDay, getTimetableJumuah, getTimetableSite } from './mosqueTimetable';

export interface Mosque {
  id: string;
  name: string;
  loc: string;
  suburb: string;
  state: string;
  area: string;
  address: string;
  lat: number;
  lng: number;
  link: string;
  iqamaOffsets: Record<string, number>;
  jumuah: string;
  distanceKm?: number;
  isCustom?: boolean;
}

export interface PrayerTimesResult {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  fajr24: string;
  dhuhr24: string;
  asr24: string;
  maghrib24: string;
  isha24: string;
  suhoorEndTime: string;
  iftarTime: string;
  /** Iqamah time per prayer ("05:00 AM"), when the mosque has one */
  iqama: Partial<Record<IqamaPrayer, string>>;
  /** Iqamah per prayer as minutes after local midnight */
  iqamaMinutes: Partial<Record<IqamaPrayer, number>>;
  /** Adhan per prayer as minutes after local midnight */
  adhanMinutes: Record<IqamaPrayer, number>;
  /** Prayers whose published Iqamah looks out of date: "check with the mosque" */
  iqamaCheck: Partial<Record<IqamaPrayer, true>>;
  /** Jumu'ah times: the mosque's Awqat notice or own timetable, else the app's list */
  jumuah: string;
  /** Friday at the mosque: Dhuhr is Jumu'ah */
  isFriday: boolean;
  /** 'awqat' when the times come from awqat.com.au, 'mosque' from the mosque's own website, 'calculated' otherwise */
  timesSource: 'awqat' | 'mosque' | 'calculated';
  /** Website the times come from, e.g. "Awqat.com.au" or "isv.org.au" (none when calculated) */
  timesSite?: string;
  /** True while the next Suhoor/Iftar belongs to a Ramadan fast (from Maghrib before 1 Ramadan until Iftar on its last day) */
  isRamadan: boolean;
  /** Day of Ramadan (1-30) of the fast the next Suhoor/Iftar belongs to */
  ramadanDay?: number;
  nextFastingEvent: {
    type: 'Suhoor' | 'Iftar';
    time: string;
    remainingFormatted: string;
    remainingSeconds: number;
  };
  nextPrayer: {
    name: 'Fajr' | 'Sunrise' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';
    time: string;
    remainingFormatted: string;
    remainingSeconds: number;
    iqamaTime?: string;
  };
  currentPrayer: string;
  /** Current wall-clock time at the mosque, "HH:MM" (24h) */
  localTime24: string;
  /** Current date at the mosque, "YYYY-MM-DD" */
  localDateKey: string;
  qiblaBearing: number;
  mosque: Mosque;
}

export const INITIAL_MOSQUES: Mosque[] = mosquesData as Mosque[];

const CUSTOM_MOSQUES_KEY = 'daily_hadith_custom_mosques_v1';
const SELECTED_MOSQUE_KEY = 'daily_hadith_selected_mosque_id_v2';

export function getAllMosques(): Mosque[] {
  try {
    const raw = localStorage.getItem(CUSTOM_MOSQUES_KEY);
    const custom: Mosque[] = raw ? JSON.parse(raw) : [];
    return [...custom, ...INITIAL_MOSQUES];
  } catch {
    return INITIAL_MOSQUES;
  }
}

export function saveCustomMosque(mosque: Omit<Mosque, 'id'>): Mosque {
  const id = `custom-${Date.now()}`;
  const newMosque: Mosque = {
    ...mosque,
    id,
    isCustom: true,
    link: mosque.link || 'https://www.awqat.com.au/'
  };

  try {
    const raw = localStorage.getItem(CUSTOM_MOSQUES_KEY);
    const custom: Mosque[] = raw ? JSON.parse(raw) : [];
    custom.unshift(newMosque);
    localStorage.setItem(CUSTOM_MOSQUES_KEY, JSON.stringify(custom));
  } catch {}

  saveSelectedMosque(id);
  return newMosque;
}

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function getMosquesSortedByDistance(userLat: number, userLng: number): Mosque[] {
  const all = getAllMosques();
  return all.map(m => ({
    ...m,
    distanceKm: calculateDistanceKm(userLat, userLng, m.lat, m.lng)
  })).sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
}

const STATE_TIMEZONES: Record<string, string> = {
  NSW: 'Australia/Sydney',
  ACT: 'Australia/Sydney',
  VIC: 'Australia/Melbourne',
  QLD: 'Australia/Brisbane',
  SA: 'Australia/Adelaide',
  WA: 'Australia/Perth',
  TAS: 'Australia/Hobart',
  NT: 'Australia/Darwin'
};

interface ZonedClock {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  offsetHours: number;
}

/**
 * Wall-clock time in the mosque's own time zone (falls back to the device
 * time zone for custom mosques outside the known Australian states).
 */
const clockFormatters = new Map<string, Intl.DateTimeFormat>();

function getZonedClock(date: Date, timeZone?: string): ZonedClock {
  if (timeZone) {
    try {
      let formatter = clockFormatters.get(timeZone);
      if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-US', {
          timeZone,
          hourCycle: 'h23',
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric'
        });
        clockFormatters.set(timeZone, formatter);
      }
      const parts = formatter.formatToParts(date);
      const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
      const clock = {
        year: get('year'),
        month: get('month'),
        day: get('day'),
        hours: get('hour') % 24,
        minutes: get('minute'),
        seconds: get('second')
      };
      const asUtc = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hours, clock.minutes, clock.seconds);
      const offsetMinutes = Math.round((asUtc - date.getTime()) / 60000);
      if (Object.values(clock).every(Number.isFinite)) {
        return { ...clock, offsetHours: offsetMinutes / 60 };
      }
    } catch {}
  }
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
    offsetHours: -date.getTimezoneOffset() / 60
  };
}

export function calculateQiblaBearing(lat: number, lng: number): number {
  const mLat = 21.422487 * (Math.PI / 180);
  const mLon = 39.826206 * (Math.PI / 180);
  const uLat = lat * (Math.PI / 180);
  const uLon = lng * (Math.PI / 180);

  const y = Math.sin(mLon - uLon);
  const x = Math.cos(uLat) * Math.tan(mLat) - Math.sin(uLat) * Math.cos(mLon - uLon);
  let qibla = Math.atan2(y, x) * (180 / Math.PI);
  return (qibla + 360) % 360;
}

export function calculateMosquePrayerTimes(
  mosque?: Mosque,
  date: Date = new Date(),
  fajrAngle: number = 18.0,
  ishaAngle: number = 18.0
): PrayerTimesResult {
  const currentMosque = mosque || getSelectedMosque();
  const lat = currentMosque.lat;
  const lng = currentMosque.lng;
  
  const timeZone = STATE_TIMEZONES[currentMosque.state?.toUpperCase()];
  const clock = getZonedClock(date, timeZone);
  const tzOffset = clock.offsetHours;

  const oneDay = 1000 * 60 * 60 * 24;
  const N = Math.round((Date.UTC(clock.year, clock.month - 1, clock.day) - Date.UTC(clock.year, 0, 0)) / oneDay);

  const M = (357.5291 + 0.98560028 * N) % 360;
  const M_rad = (M * Math.PI) / 180;
  const C = 1.9148 * Math.sin(M_rad) + 0.02 * Math.sin(2 * M_rad) + 0.0003 * Math.sin(3 * M_rad);
  const L = (280.4665 + 0.98564736 * N + C) % 360;
  const L_rad = (L * Math.PI) / 180;

  const sin_dec = Math.sin((23.44 * Math.PI) / 180) * Math.sin(L_rad);
  const dec_rad = Math.asin(sin_dec);

  const y = Math.tan((23.44 * Math.PI) / 360) ** 2;
  const EqT = 4 * ((y * Math.sin(2 * L_rad) - 2 * 0.0167 * Math.sin(M_rad) + 4 * 0.0167 * y * Math.sin(M_rad) * Math.cos(2 * L_rad) - 0.5 * (y ** 2) * Math.sin(4 * L_rad) - 1.25 * (0.0167 ** 2) * Math.sin(2 * M_rad)) * 180) / Math.PI;

  const dhuhr_utc = 12 + (-lng / 15.0) - (EqT / 60.0);
  const dhuhr_val = dhuhr_utc + tzOffset;

  const lat_rad = (lat * Math.PI) / 180;

  const hour_angle = (angle: number, is_sun = false): number | null => {
    const h0 = is_sun ? -0.8333 : -angle;
    const h0_rad = (h0 * Math.PI) / 180;
    const cos_ha = (Math.sin(h0_rad) - Math.sin(lat_rad) * Math.sin(dec_rad)) / (Math.cos(lat_rad) * Math.cos(dec_rad));
    if (cos_ha > 1 || cos_ha < -1) return null;
    return (Math.acos(cos_ha) * 180) / Math.PI / 15.0;
  };

  const ha_sun = hour_angle(0, true) || 6;
  const sunrise_val = dhuhr_val - ha_sun;
  const sunset_val = dhuhr_val + ha_sun;

  const ha_fajr = hour_angle(fajrAngle);
  const fajr_val = ha_fajr ? dhuhr_val - ha_fajr : sunrise_val - 1.5;

  const ha_isha = hour_angle(ishaAngle);
  const isha_val = ha_isha ? dhuhr_val + ha_isha : sunset_val + 1.5;

  const asr_alt = (Math.atan(1.0 / (1.0 + Math.tan(Math.abs(lat_rad - dec_rad)))) * 180) / Math.PI;
  const asr_alt_rad = (asr_alt * Math.PI) / 180;
  const cos_ha_asr = (Math.sin(asr_alt_rad) - Math.sin(lat_rad) * Math.sin(dec_rad)) / (Math.cos(lat_rad) * Math.cos(dec_rad));
  const ha_asr = (Math.acos(Math.max(-1, Math.min(1, cos_ha_asr))) * 180) / Math.PI / 15.0;
  const asr_val = dhuhr_val + ha_asr;
  const maghrib_val = sunset_val;

  const formatDecTime = (t: number): { formatted: string; formatted24: string; totalMinutes: number } => {
    let normalized = (t % 24 + 24) % 24;
    const hours = Math.floor(normalized);
    let mins = Math.round((normalized - hours) * 60);
    let finalH = hours;
    if (mins === 60) {
      finalH = (finalH + 1) % 24;
      mins = 0;
    }
    const period = finalH < 12 ? 'AM' : 'PM';
    let h12 = finalH % 12;
    if (h12 === 0) h12 = 12;
    
    const formatted = `${String(h12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${period}`;
    const formatted24 = `${String(finalH).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    
    return { formatted, formatted24, totalMinutes: finalH * 60 + mins };
  };

  // Mosques listed on awqat.com.au use Awqat's own timetable, adjustments and Iqamah;
  // mosques that publish a yearly timetable on their website use that
  const timesSource: PrayerTimesResult['timesSource'] = !timeZone
    ? 'calculated'
    : getAwqatDay(currentMosque.id, clock.year, clock.month, clock.day, timeZone)
      ? 'awqat'
      : getTimetableDay(currentMosque.id, clock.year, clock.month, clock.day, timeZone)
        ? 'mosque'
        : 'calculated';
  const awqatDayFor = (offsetDays: number) => {
    if (!timeZone || timesSource === 'calculated') return null;
    const d = new Date(Date.UTC(clock.year, clock.month - 1, clock.day + offsetDays));
    const get = timesSource === 'awqat' ? getAwqatDay : getTimetableDay;
    return get(currentMosque.id, d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), timeZone);
  };
  const awqat = awqatDayFor(0);
  const dayTimes = awqat
    ? awqat.times.map((m) => m / 60)
    : [fajr_val, sunrise_val, dhuhr_val, asr_val, maghrib_val, isha_val];

  const fObj = formatDecTime(dayTimes[0]);
  const sObj = formatDecTime(dayTimes[1]);
  const dObj = formatDecTime(dayTimes[2]);
  const aObj = formatDecTime(dayTimes[3]);
  const mObj = formatDecTime(dayTimes[4]);
  const iObj = formatDecTime(dayTimes[5]);

  // Iqamah: Awqat's times (fixed or minutes after the Adhan), else the app's offsets
  const iqamaMinutes = (name: IqamaPrayer, adhan: number): number | undefined => {
    if (awqat) return awqat.iqama[name];
    const offset = currentMosque.iqamaOffsets?.[name] ?? ({ Fajr: 20, Dhuhr: 15, Asr: 15, Maghrib: 5, Isha: 10 } as const)[name];
    return adhan + offset;
  };
  const iqamaFor = {
    Fajr: iqamaMinutes('Fajr', fObj.totalMinutes),
    Dhuhr: iqamaMinutes('Dhuhr', dObj.totalMinutes),
    Asr: iqamaMinutes('Asr', aObj.totalMinutes),
    Maghrib: iqamaMinutes('Maghrib', mObj.totalMinutes),
    Isha: iqamaMinutes('Isha', iObj.totalMinutes)
  };
  const iqama: Partial<Record<IqamaPrayer, string>> = {};
  for (const [name, mins] of Object.entries(iqamaFor)) {
    if (mins !== undefined) iqama[name as IqamaPrayer] = formatDecTime(mins / 60).formatted;
  }

  // After Isha the next Fajr is tomorrow's
  const tomorrow = awqatDayFor(1);
  const tomorrowFajr = tomorrow ? formatDecTime(tomorrow.times[0] / 60) : fObj;
  const tomorrowFajrIqama = tomorrow ? tomorrow.iqama.Fajr : iqamaFor.Fajr;

  const currentMinutes = clock.hours * 60 + clock.minutes + clock.seconds / 60;
  type ScheduleEntry = { name: PrayerTimesResult['nextPrayer']['name']; mins: number; time: string; iqama: number | undefined };
  const schedule: ScheduleEntry[] = [
    { name: 'Fajr' as const, mins: fObj.totalMinutes, time: fObj.formatted, iqama: iqamaFor.Fajr },
    { name: 'Sunrise' as const, mins: sObj.totalMinutes, time: sObj.formatted, iqama: undefined },
    { name: 'Dhuhr' as const, mins: dObj.totalMinutes, time: dObj.formatted, iqama: iqamaFor.Dhuhr },
    { name: 'Asr' as const, mins: aObj.totalMinutes, time: aObj.formatted, iqama: iqamaFor.Asr },
    { name: 'Maghrib' as const, mins: mObj.totalMinutes, time: mObj.formatted, iqama: iqamaFor.Maghrib },
    { name: 'Isha' as const, mins: iObj.totalMinutes, time: iObj.formatted, iqama: iqamaFor.Isha }
  ];

  // Wall-clock gaps are off by an hour when the clocks change in between (the
  // night daylight saving starts or ends); measure the real time instead
  const realSeconds = (wallSeconds: number): number => {
    if (!timeZone) return wallSeconds;
    const later = getZonedClock(new Date(date.getTime() + wallSeconds * 1000), timeZone);
    return Math.max(0, wallSeconds - Math.round((later.offsetHours - clock.offsetHours) * 3600));
  };

  let next = schedule.find(p => p.mins > currentMinutes);
  let currentPrayerName = 'Isha';
  let diffSec = 0;

  if (next) {
    diffSec = Math.round((next.mins - currentMinutes) * 60);
    const idx = schedule.indexOf(next);
    currentPrayerName = idx === 0 ? 'Isha' : schedule[idx - 1].name;
  } else {
    next = { ...schedule[0], mins: tomorrowFajr.totalMinutes, time: tomorrowFajr.formatted, iqama: tomorrowFajrIqama };
    diffSec = Math.round((1440 - currentMinutes + next.mins) * 60);
    currentPrayerName = 'Isha';
  }
  diffSec = realSeconds(diffSec);

  const remHours = Math.floor(diffSec / 3600);
  const remMins = Math.floor((diffSec % 3600) / 60);
  const remSecs = diffSec % 60;
  const remainingFormatted = remHours > 0
    ? `${remHours}h ${remMins}m`
    : `${remMins}m ${remSecs}s`;

  // Fasting Iftar & Suhoor logic
  let fastType: 'Suhoor' | 'Iftar' = 'Iftar';
  let fastTime = mObj.formatted;
  let fastDiffSec = 0;

  if (currentMinutes < fObj.totalMinutes) {
    // Before Fajr -> Suhoor ends at Fajr
    fastType = 'Suhoor';
    fastTime = fObj.formatted;
    fastDiffSec = Math.round((fObj.totalMinutes - currentMinutes) * 60);
  } else if (currentMinutes < mObj.totalMinutes) {
    // Fasting during day -> Iftar at Maghrib
    fastType = 'Iftar';
    fastTime = mObj.formatted;
    fastDiffSec = Math.round((mObj.totalMinutes - currentMinutes) * 60);
  } else {
    // Past Maghrib -> Next Suhoor ends at tomorrow's Fajr
    fastType = 'Suhoor';
    fastTime = tomorrowFajr.formatted;
    fastDiffSec = Math.round((1440 - currentMinutes + tomorrowFajr.totalMinutes) * 60);
  }

  // The fast the next Suhoor/Iftar belongs to: tomorrow's once Maghrib has passed, otherwise today's
  const fastDay = new Date(clock.year, clock.month - 1, clock.day + (currentMinutes >= mObj.totalMinutes ? 1 : 0));
  const fastHijri = getHijriDate(fastDay);
  const isRamadan = fastHijri.month === 'Ramadan';

  fastDiffSec = realSeconds(fastDiffSec);
  const fHours = Math.floor(fastDiffSec / 3600);
  const fMins = Math.floor((fastDiffSec % 3600) / 60);
  const fSecs = fastDiffSec % 60;
  const fastRemFormatted = fHours > 0 ? `${fHours}h ${fMins}m` : `${fMins}m ${fSecs}s`;


  const qibla = calculateQiblaBearing(lat, lng);

  return {
    fajr: fObj.formatted,
    sunrise: sObj.formatted,
    dhuhr: dObj.formatted,
    asr: aObj.formatted,
    maghrib: mObj.formatted,
    isha: iObj.formatted,
    fajr24: fObj.formatted24,
    dhuhr24: dObj.formatted24,
    asr24: aObj.formatted24,
    maghrib24: mObj.formatted24,
    isha24: iObj.formatted24,
    suhoorEndTime: fObj.formatted,
    iftarTime: mObj.formatted,
    iqama,
    iqamaMinutes: Object.fromEntries(Object.entries(iqamaFor).filter(([, m]) => m !== undefined)) as Partial<Record<IqamaPrayer, number>>,
    adhanMinutes: { Fajr: fObj.totalMinutes, Dhuhr: dObj.totalMinutes, Asr: aObj.totalMinutes, Maghrib: mObj.totalMinutes, Isha: iObj.totalMinutes },
    iqamaCheck: awqat?.iqamaCheck ?? {},
    jumuah: getMosqueJumuah(currentMosque),
    timesSource: awqat ? timesSource : 'calculated',
    timesSite: !awqat ? undefined : timesSource === 'awqat' ? 'Awqat.com.au' : getTimetableSite(currentMosque.id) ?? undefined,
    isFriday: new Date(Date.UTC(clock.year, clock.month - 1, clock.day)).getUTCDay() === 5,
    isRamadan,
    ramadanDay: isRamadan ? fastHijri.day : undefined,
    nextFastingEvent: {
      type: fastType,
      time: fastTime,
      remainingFormatted: fastRemFormatted,
      remainingSeconds: fastDiffSec
    },
    nextPrayer: {
      name: next.name,
      time: next.time,
      remainingFormatted,
      remainingSeconds: diffSec,
      iqamaTime: next.iqama !== undefined && next.iqama !== next.mins ? formatDecTime(next.iqama / 60).formatted : undefined
    },
    currentPrayer: currentPrayerName,
    localTime24: `${String(clock.hours).padStart(2, '0')}:${String(clock.minutes).padStart(2, '0')}`,
    localDateKey: `${clock.year}-${String(clock.month).padStart(2, '0')}-${String(clock.day).padStart(2, '0')}`,
    qiblaBearing: Math.round(qibla),
    mosque: currentMosque
  };
}

/** Jumu'ah times: the mosque's Awqat notice or own timetable when they give them, else the app's list. */
export function getMosqueJumuah(mosque: Mosque): string {
  return getAwqatJumuah(mosque.id) ?? getTimetableJumuah(mosque.id) ?? mosque.jumuah;
}

export function getSelectedMosque(): Mosque {
  const all = getAllMosques();
  try {
    const savedId = localStorage.getItem(SELECTED_MOSQUE_KEY);
    if (savedId) {
      const found = all.find(m => m.id === savedId);
      if (found) return found;
    }
  } catch {}
  return all[0] || INITIAL_MOSQUES[0];
}

export const MOSQUE_CHANGE_EVENT = 'daily-hadith:mosque-change';

export function saveSelectedMosque(mosqueId: string): void {
  try {
    localStorage.setItem(SELECTED_MOSQUE_KEY, mosqueId);
  } catch {}
  window.dispatchEvent(new Event(MOSQUE_CHANGE_EVENT));
}

/**
 * Returns the prayer whose start time matches the mosque's current minute, if any.
 */
export function getDuePrayer(result: PrayerTimesResult): { name: string; time: string } | null {
  const schedule = [
    { name: 'Fajr', time: result.fajr, time24: result.fajr24 },
    { name: 'Dhuhr', time: result.dhuhr, time24: result.dhuhr24 },
    { name: 'Asr', time: result.asr, time24: result.asr24 },
    { name: 'Maghrib', time: result.maghrib, time24: result.maghrib24 },
    { name: 'Isha', time: result.isha, time24: result.isha24 }
  ];
  const due = schedule.find(p => p.time24 === result.localTime24);
  return due ? { name: due.name, time: due.time } : null;
}
