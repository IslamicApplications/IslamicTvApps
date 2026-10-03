import timetableData from '../data/mosqueTimetables.json';
import { AwqatDay, IqamaPrayer, daylightSavingMinutes } from './awqat';

/**
 * Yearly timetables (Adhan and Iqamah for every day) that mosques publish on their
 * own website, e.g. Preston Mosque at https://isv.org.au/ (synced into
 * mosqueTimetables.json by `npm run mosques:data`).
 */
interface MosqueTimetable {
  site: string;
  widget: string;
  name: string;
  timeZone: string;
  fetched: string;
  jumuah: string | null;
  /** "MM-DD" -> Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha Adhan, then the five Iqamahs, in standard-time minutes */
  days: Record<string, number[]>;
}

const data = timetableData as Record<string, MosqueTimetable>;

const IQAMA_PRAYERS: IqamaPrayer[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const ADHAN_INDEX: Record<IqamaPrayer, number> = { Fajr: 0, Dhuhr: 2, Asr: 3, Maghrib: 4, Isha: 5 };

/** The mosque website the timetable comes from, e.g. "isv.org.au" */
export function getTimetableSite(mosqueId: string): string | null {
  const site = data[mosqueId]?.site;
  return site ? new URL(site).hostname.replace(/^www\./, '') : null;
}

/** The mosque's own times on a calendar day in its time zone, or null if it has no timetable. */
export function getTimetableDay(mosqueId: string, year: number, month: number, day: number, timeZone: string): AwqatDay | null {
  const table = data[mosqueId];
  if (!table) return null;
  const key = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const row = table.days[key] ?? table.days['02-28'];
  if (!row) return null;

  const dst = daylightSavingMinutes(year, month, day, timeZone);
  const times = row.slice(0, 6).map((t) => t + dst);
  const iqama: AwqatDay['iqama'] = {};
  const iqamaCheck: AwqatDay['iqamaCheck'] = {};
  IQAMA_PRAYERS.forEach((name, i) => {
    const at = row[6 + i] + dst;
    const adhan = times[ADHAN_INDEX[name]];
    const end = name === 'Isha' ? 24 * 60 : times[ADHAN_INDEX[name] + 1];
    if (at < adhan || at >= end) iqamaCheck[name] = true;
    else iqama[name] = at;
  });
  return { times, iqama, iqamaCheck };
}

/** Jumu'ah times from the mosque's timetable, e.g. "12:30 PM". */
export function getTimetableJumuah(mosqueId: string): string | null {
  return data[mosqueId]?.jumuah ?? null;
}
