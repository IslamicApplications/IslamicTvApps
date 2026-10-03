import { Hadith, DailySelection } from '../types/hadith';
import dailyPoolData from '../data/daily_pool.json';
import { getHijriDate } from './hijri';

const dailyPool: Hadith[] = dailyPoolData as Hadith[];

/**
 * Deterministic pseudo-random permutation seed generator.
 * Permutes indices 0 .. poolLength-1 so each day picks a distinct Hadith
 * without repetition until all items are displayed.
 */
function getDeterministicIndex(dayOffset: number, poolLength: number): number {
  if (poolLength <= 0) return 0;
  // Linear congruential generator parameters coprime with cycle length
  const A = 1664525;
  const C = 1013904223;
  const SEED = 4294967; // Fixed constant seed for global synchronization
  
  // Cycle index and position within the cycle
  const cycle = Math.floor(dayOffset / poolLength);
  const posInCycle = ((dayOffset % poolLength) + poolLength) % poolLength;
  
  // Seeded permutation for current cycle
  const combinedSeed = (SEED + cycle * 7919) >>> 0;
  const hashed = ((posInCycle * A + C + combinedSeed) % poolLength + poolLength) % poolLength;
  
  return hashed;
}

/**
 * Calculates total elapsed days from an epoch anchor (2024-01-01) in device local time.
 */
export function getDaysSinceEpoch(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // Create midnight UTC date to avoid DST hour skew
  const currentUtcMidnight = Date.UTC(year, month, day);
  const epochUtcMidnight = Date.UTC(2024, 0, 1);
  
  return Math.floor((currentUtcMidnight - epochUtcMidnight) / (24 * 60 * 60 * 1000));
}

/**
 * Returns formatted local ISO date string "YYYY-MM-DD".
 */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Selects the verified Daily Hadith for any given date deterministically.
 */
export function getDailyHadith(date: Date = new Date()): DailySelection {
  const dayOffset = getDaysSinceEpoch(date);
  const poolLen = dailyPool.length;
  const index = getDeterministicIndex(dayOffset, poolLen);
  const hadith = dailyPool[index] || dailyPool[0];
  const dateStr = formatDateKey(date);
  const hijri = getHijriDate(date).formatted;

  return {
    dateString: dateStr,
    hadith,
    index,
    hijriDate: hijri
  };
}

/**
 * Returns total count of available curated daily Hadiths.
 */
export function getDailyPoolSize(): number {
  return dailyPool.length;
}

/**
 * Returns a slice of recent past daily Hadiths for the history browser.
 */
export function getRecentDailyHadiths(daysCount: number = 30, baseDate: Date = new Date()): DailySelection[] {
  const results: DailySelection[] = [];
  for (let i = 0; i < daysCount; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() - i);
    results.push(getDailyHadith(d));
  }
  return results;
}
