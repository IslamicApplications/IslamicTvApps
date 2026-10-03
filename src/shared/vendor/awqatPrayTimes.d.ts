/** Awqat's PrayTimes.js (praytimes.org v2, with Awqat's DST change). */
declare class PrayTimes {
  constructor(method?: string);
  setMethod(method: string): void;
  adjust(params: Record<string, string | number>): void;
  getTimes(
    date: [number, number, number],
    coords: [number | string, number | string],
    timezone: number | string,
    dst: number | string,
    format?: '24h' | '12h' | '12hNS' | 'Float'
  ): Record<'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha', string>;
}
export default PrayTimes;
