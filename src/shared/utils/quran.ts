/**
 * Quran recitation for the TV, from the Quran Foundation's public Quran.com API
 * (https://api-docs.quran.foundation). Audio is streamed from quranicaudio.com;
 * the verse timings let the screen show the verse being recited.
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
  /** Quran.com chapter-recitation id */
  id: number;
  name: string;
  nameAr: string;
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
  { id: 5, name: "Hani ar-Rifa'i", nameAr: 'هاني الرفاعي' }
];

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
