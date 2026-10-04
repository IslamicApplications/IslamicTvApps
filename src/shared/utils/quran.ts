/**
 * Quran recitation for the TV, from the Quran Foundation's public Quran.com API
 * (https://api-docs.quran.foundation). Audio is streamed from quranicaudio.com;
 * the verse timings let the screen show the verse being recited. A few reciters
 * stream from Quran Central (qurancentral.com) instead, without verse timings.
 */
import surahsData from '../data/surahs.json';

const API = 'https://api.quran.com/api/v4';

export interface Surah {
  n: number;
  ar: string;
  en: string;
  meaning: string;
  verses: number;
  bismillah: boolean;
}

export const SURAHS = surahsData as Surah[];

export interface Reciter {
  /** Quran.com chapter-recitation id (Quran Central reciters: their Quran Central id) */
  id: number;
  name: string;
  nameAr: string;
  /**
   * Quran Central reciter: its folder on podcasts.qurancentral.com, which has one file
   * per surah (001.mp3 … 114.mp3) and no verse timings. The files are refused when the
   * request names another site as the referrer, so index.html sets `no-referrer`.
   */
  quranCentral?: string;
}

export const RECITERS: Reciter[] = [
  { id: 7, name: 'Mishary Rashid Alafasy', nameAr: 'مشاري راشد العفاسي' },
  { id: 3, name: 'Abdur-Rahman as-Sudais', nameAr: 'عبد الرحمن السديس' },
  { id: 10, name: "Sa'ud ash-Shuraym", nameAr: 'سعود الشريم' },
  { id: 159, name: "Maher al-Mu'aiqly", nameAr: 'ماهر المعيقلي' },
  { id: 174, name: 'Yasser ad-Dussary', nameAr: 'ياسر الدوسري' },
  { id: 2, name: 'Abdul Basit (Murattal)', nameAr: 'عبد الباسط عبد الصمد (مرتل)' },
  { id: 1, name: 'Abdul Basit (Mujawwad)', nameAr: 'عبد الباسط عبد الصمد (مجود)' },
  { id: 6, name: 'Mahmoud Khalil al-Husary', nameAr: 'محمود خليل الحصري' },
  { id: 9, name: 'Mohamed Siddiq al-Minshawi', nameAr: 'محمد صديق المنشاوي' },
  { id: 4, name: 'Abu Bakr al-Shatri', nameAr: 'أبو بكر الشاطري' },
  { id: 13, name: "Sa'd al-Ghamdi", nameAr: 'سعد الغامدي' },
  { id: 5, name: "Hani ar-Rifa'i", nameAr: 'هاني الرفاعي' },
  { id: 2919, name: 'Muhammad al-Faqih', nameAr: 'محمد الفقيه', quranCentral: 'muhammad-al-faqih' }
];

/** False for reciters whose recitations have no verse timings (the verse can't be followed). */
export function hasVerseTimings(reciter: number): boolean {
  return !RECITERS.find((r) => r.id === reciter)?.quranCentral;
}

export const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';

export interface QuranSettings {
  reciter: number;
  surah: number;
  /** Go on to the next surah when one ends */
  continuous: boolean;
}

const SETTINGS_KEY = 'daily_hadith_tv_quran';

export function getQuranSettings(): QuranSettings {
  const fallback: QuranSettings = { reciter: RECITERS[0].id, surah: 1, continuous: true };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (!saved) return fallback;
    return {
      reciter: RECITERS.some((r) => r.id === saved.reciter) ? saved.reciter : fallback.reciter,
      surah: saved.surah >= 1 && saved.surah <= 114 ? saved.surah : 1,
      continuous: saved.continuous !== false
    };
  } catch {
    return fallback;
  }
}

export function saveQuranSettings(settings: QuranSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

/** Where the recitation was stopped or paused, so it can carry on from there. */
export interface QuranPosition {
  surah: number;
  reciter: number;
  /** Seconds into the surah's audio */
  time: number;
  /** Verse number, for carrying on with another reciter */
  verse: number;
}

const POSITION_KEY = 'daily_hadith_tv_quran_position';

export function getQuranPosition(): QuranPosition | null {
  try {
    const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || 'null');
    if (!saved || !(saved.surah >= 1 && saved.surah <= 114) || !(saved.time >= 0) || !(saved.verse >= 1)) return null;
    return { surah: saved.surah, reciter: Number(saved.reciter), time: saved.time, verse: saved.verse };
  } catch {
    return null;
  }
}

export function saveQuranPosition(position: QuranPosition | null): void {
  try {
    if (position) localStorage.setItem(POSITION_KEY, JSON.stringify(position));
    else localStorage.removeItem(POSITION_KEY);
  } catch {}
}

/**
 * Where to start a surah, in seconds: the saved second with the same reciter, the start
 * of the same verse with another reciter, or the beginning.
 */
export function resumeStartSeconds(from: QuranPosition | null | undefined, surah: number, reciter: number, timings: VerseTiming[]): number {
  if (!from || from.surah !== surah) return 0;
  if (from.reciter === reciter) return from.time;
  return (timings.find((t) => t.verse === from.verse)?.from ?? 0) / 1000;
}

export interface VerseTiming {
  /** Verse number within the surah */
  verse: number;
  /** Milliseconds from the start of the audio */
  from: number;
  to: number;
}

export interface Recitation {
  url: string;
  timings: VerseTiming[];
}

export interface SurahText {
  arabic: string[];
  /** Saheeh International, one entry per verse */
  english: string[];
}

const recitationCache = new Map<string, Promise<Recitation>>();
const textCache = new Map<number, Promise<SurahText>>();

async function getJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Quran API ${res.status}`);
  return res.json();
}

/** Audio file and verse timings for one surah by one reciter. */
export function loadRecitation(reciter: number, surah: number): Promise<Recitation> {
  const folder = RECITERS.find((r) => r.id === reciter)?.quranCentral;
  if (folder) {
    return Promise.resolve({ url: `https://podcasts.qurancentral.com/${folder}/${String(surah).padStart(3, '0')}.mp3`, timings: [] });
  }
  const key = `${reciter}:${surah}`;
  if (!recitationCache.has(key)) {
    const request = getJson(`${API}/chapter_recitations/${reciter}/${surah}?segments=true`).then((data) => {
      const file = data.audio_file;
      if (!file?.audio_url) throw new Error('No recitation');
      const timings: VerseTiming[] = (file.timestamps ?? []).map((t: any) => ({
        verse: Number(String(t.verse_key).split(':')[1]),
        from: t.timestamp_from,
        to: t.timestamp_to
      }));
      return { url: file.audio_url, timings };
    });
    request.catch(() => recitationCache.delete(key));
    recitationCache.set(key, request);
  }
  return recitationCache.get(key)!;
}

/** "Allāh,<sup foot_note=1>1</sup> the" -> "Allāh, the" */
export function cleanTranslation(text: string): string {
  return text
    .replace(/<sup[^>]*>.*?<\/sup>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Uthmani text and the Saheeh International translation of a surah. */
export function loadSurahText(surah: number): Promise<SurahText> {
  if (!textCache.has(surah)) {
    const request = Promise.all([
      getJson(`${API}/quran/verses/uthmani?chapter_number=${surah}`),
      getJson(`${API}/quran/translations/20?chapter_number=${surah}`)
    ]).then(([verses, translation]) => ({
      arabic: verses.verses.map((v: any) => v.text_uthmani as string),
      english: translation.translations.map((v: any) => cleanTranslation(v.text))
    }));
    request.catch(() => textCache.delete(surah));
    textCache.set(surah, request);
  }
  return textCache.get(surah)!;
}

/** Index of the verse being recited at `ms` (the last one started). */
export function verseAt(timings: VerseTiming[], ms: number): number {
  let index = 0;
  for (let i = 0; i < timings.length; i++) {
    if (timings[i].from <= ms) index = i;
    else break;
  }
  return index;
}
