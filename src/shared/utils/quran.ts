/**
 * Quran recitation for the TV, from the Quran Foundation's public Quran.com API
 * (https://api-docs.quran.foundation). Audio is streamed from quranicaudio.com;
 * the verse timings let the screen show the verse being recited. A few reciters
 * stream from Quran Central (qurancentral.com) instead, without verse timings, and the
 * English translations from the Islamic Network's CDN (the files api.alquran.cloud lists),
 * the Oromo translation from the Internet Archive, and the Somali translation verse by verse
 * from QuranEnc (quranenc.com).
 */
import surahsData from '../data/surahs.json';
import oromoFiles from '../data/oromoQuran.json';

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
  /**
   * Quran.com's verse timings are for another recording than its audio (Maher al-Mu'aiqly:
   * Al-Fatihah's end at 37 s of 63 s): played without them, like Quran Central's.
   */
  timingsOff?: boolean;
  /**
   * The verse timings are close enough to show the verse, but too far off (up to a second,
   * about one verse in five) to stop the recitation for the English after each verse.
   */
  roughTimings?: boolean;
  /**
   * How loud the recitation is (LUFS, measured on Al-Fatihah and Al-Mulk), where it is louder
   * than the English after each verse (ENGLISH_LOUDNESS): turned down to match while that's on.
   */
  loudness?: number;
  /**
   * English translation: its edition on cdn.islamic.network. Surah by surah (the Arabic
   * recitation with the translation after each verse, no verse timings) or, with
   * `verseByVerse`, one file per verse read in English only, played one after another.
   */
  islamicNetwork?: string;
  verseByVerse?: boolean;
  /** Read in English, so its translation shows whatever the Hadith language */
  english?: boolean;
  /**
   * Translation on the Internet Archive: the item's id and its files, one per surah in order
   * (their names follow no one pattern). Streamed surah by surah, without verse timings.
   */
  archive?: { item: string; files: string[] };
  /** Translation on QuranEnc: its id on d.quranenc.com, one file per verse played one after another. */
  quranEnc?: string;
  /**
   * With `quranEnc`: each verse recited in Arabic first, from this reciter's verse files on
   * everyayah.com, then its translation; the translation turned down to `translationVolume`.
   */
  everyAyah?: string;
  translationVolume?: number;
}

export const RECITERS: Reciter[] = [
  { id: 7, name: 'Mishary Rashid Alafasy', nameAr: 'مشاري راشد العفاسي' },
  { id: 3, name: 'Abdur-Rahman as-Sudais', nameAr: 'عبد الرحمن السديس', loudness: -16.4 },
  { id: 10, name: "Sa'ud ash-Shuraym", nameAr: 'سعود الشريم' },
  { id: 159, name: "Maher al-Mu'aiqly", nameAr: 'ماهر المعيقلي', timingsOff: true },
  { id: 174, name: 'Yasser ad-Dussary', nameAr: 'ياسر الدوسري', roughTimings: true },
  { id: 2, name: 'Abdul Basit (Murattal)', nameAr: 'عبد الباسط عبد الصمد (مرتل)', loudness: -16.6 },
  { id: 1, name: 'Abdul Basit (Mujawwad)', nameAr: 'عبد الباسط عبد الصمد (مجود)', loudness: -14.6 },
  { id: 6, name: 'Mahmoud Khalil al-Husary', nameAr: 'محمود خليل الحصري', loudness: -16.9 },
  { id: 9, name: 'Mohamed Siddiq al-Minshawi', nameAr: 'محمد صديق المنشاوي', loudness: -12.8 },
  { id: 4, name: 'Abu Bakr al-Shatri', nameAr: 'أبو بكر الشاطري' },
  { id: 13, name: "Sa'd al-Ghamdi", nameAr: 'سعد الغامدي' },
  { id: 5, name: "Hani ar-Rifa'i", nameAr: 'هاني الرفاعي' },
  { id: 2919, name: 'Muhammad al-Faqih', nameAr: 'محمد الفقيه', quranCentral: 'muhammad-al-faqih' },
  // English translations (ids of our own, above Quran.com's)
  { id: 9001, name: 'English: Ibrahim Walk (Saheeh International)', nameAr: 'ترجمة إنجليزية: إبراهيم ووك (صحيح إنترناشونال)', islamicNetwork: 'en.walk', verseByVerse: true, english: true },
  { id: 9002, name: 'Alafasy + English (Saheeh International)', nameAr: 'العفاسي + ترجمة إنجليزية (صحيح إنترناشونال)', islamicNetwork: 'en.misharyrashidalafasyenglishtranslationsaheehibrahimwalk', english: true },
  { id: 9003, name: 'Muhammad Ayyub + English (Muhsin Khan)', nameAr: 'محمد أيوب + ترجمة إنجليزية (محسن خان)', islamicNetwork: 'en.muhammadayyubenglishtranslationmuhsinkhanmikaalwaters', english: true },
  { id: 9004, name: 'Sudais & Shuraym + English (Pickthall)', nameAr: 'السديس والشريم + ترجمة إنجليزية (بكثال)', islamicNetwork: 'en.sudaisandshuraymenglishtranslationpickthallaslamathar', english: true },
  // Other languages
  {
    id: 9101,
    name: 'Oromo translation (Afaan Oromoo)',
    nameAr: 'ترجمة بلغة الأورومو',
    archive: { item: 'Translation_of_the_Noble_Quran_in_the_Oromo_Language-HQ-Audio-MP3', files: oromoFiles as string[] }
  },
  { id: 9102, name: 'Somali Translation - Abdullah Hasan Yaqoub', nameAr: 'ترجمة صومالية: عبد الله حسن يعقوب', quranEnc: 'somali_yacob' },
  // The Somali is about 5 LU louder than al-Hudhaify (Al-Fatihah, Al-Mulk)
  {
    id: 9103,
    name: 'Al-Hudhaify + Somali Translation - Abdullah Hasan Yaqoub',
    nameAr: 'الحذيفي + ترجمة صومالية: عبد الله حسن يعقوب',
    quranEnc: 'somali_yacob',
    everyAyah: 'Hudhaify_128kbps',
    translationVolume: 0.6
  }
];

/** False for reciters whose recitations have no verse timings (the verse can't be followed). */
export function hasVerseTimings(reciter: number): boolean {
  const r = RECITERS.find((r) => r.id === reciter);
  return !r?.quranCentral && !r?.archive && !r?.timingsOff && (!r?.islamicNetwork || !!r.verseByVerse);
}

/**
 * The English translation can follow each verse: an Arabic reciter from Quran.com, whose
 * verse timings show where each verse ends (not Quran Central's or the English ones).
 */
export function canAddEnglish(reciter: number): boolean {
  const r = RECITERS.find((r) => r.id === reciter);
  return !!r && !r.quranCentral && !r.islamicNetwork && !r.archive && !r.quranEnc && !r.timingsOff && !r.roughTimings;
}

/** Ibrahim Walk's English (LUFS); a browser can't make audio louder, so a louder reciter is turned down */
export const ENGLISH_LOUDNESS = -19.3;

/**
 * Volume for the Arabic while the English follows each verse, so the two sound about as loud
 * (1 when the reciter is no louder than the English, or the English is off).
 */
export function arabicVolume(reciter: number, englishAfterVerse: boolean): number {
  const loudness = RECITERS.find((r) => r.id === reciter)?.loudness;
  if (!englishAfterVerse || !canAddEnglish(reciter) || loudness === undefined || loudness <= ENGLISH_LOUDNESS) return 1;
  return Math.round(10 ** ((ENGLISH_LOUDNESS - loudness) / 20) * 100) / 100;
}

/** The reciter reads in English (its translation is shown whatever the Hadith language). */
export function isEnglishReciter(reciter: number): boolean {
  return !!RECITERS.find((r) => r.id === reciter)?.english;
}

export const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';

export interface QuranSettings {
  reciter: number;
  surah: number;
  /** Go on to the next surah when one ends */
  continuous: boolean;
  /** After each Arabic verse, its English translation read by Ibrahim Walk */
  englishAfterVerse: boolean;
}

const SETTINGS_KEY = 'daily_hadith_tv_quran';

export function getQuranSettings(): QuranSettings {
  const fallback: QuranSettings = { reciter: RECITERS[0].id, surah: 1, continuous: true, englishAfterVerse: false };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (!saved) return fallback;
    return {
      reciter: RECITERS.some((r) => r.id === saved.reciter) ? saved.reciter : fallback.reciter,
      surah: saved.surah >= 1 && saved.surah <= 114 ? saved.surah : 1,
      continuous: saved.continuous !== false,
      englishAfterVerse: saved.englishAfterVerse === true
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
 * of the same verse with another reciter, or the beginning. For a reciter with one file
 * per verse, the file is the saved verse's (see resumeTrack) and the time is within it.
 */
export function resumeStartSeconds(from: QuranPosition | null | undefined, surah: number, reciter: number, timings: VerseTiming[]): number {
  if (!from || from.surah !== surah) return 0;
  if (from.reciter === reciter) return from.time;
  return (timings.find((t) => t.verse === from.verse)?.from ?? 0) / 1000;
}

/** For a reciter with one file per verse: the file (verse index) to start the surah at. */
export function resumeTrack(from: QuranPosition | null | undefined, surah: number, trackCount: number): number {
  if (!from || from.surah !== surah) return 0;
  return Math.min(Math.max(from.verse - 1, 0), trackCount - 1);
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
  /** One file per verse, played in turn (url is the first) */
  tracks?: string[];
  /** Files per verse in `tracks` (default 1): the Arabic, then its translation */
  filesPerVerse?: number;
  /** Volume of each verse's translation file (after the first) */
  translationVolume?: number;
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

/** Number of the surah's first verse counting from the start of the Quran (Al-Fatihah 1 is 1). */
export function firstVerseNumber(surah: number): number {
  return SURAHS.slice(0, surah - 1).reduce((n, s) => n + s.verses, 0) + 1;
}

/** One verse's file in a verse-by-verse edition on cdn.islamic.network (numbered through the whole Quran). */
export function verseAudioUrl(edition: string, surah: number, verse: number): string {
  return `https://cdn.islamic.network/quran/audio/192/${edition}/${firstVerseNumber(surah) + verse - 1}.mp3`;
}

/** The English translation of one verse, read by Ibrahim Walk (Saheeh International). */
export function englishVerseUrl(surah: number, verse: number): string {
  return verseAudioUrl('en.walk', surah, verse);
}

/**
 * With the English after each verse: the verse (index) whose Arabic has just ended at `ms`
 * and whose English is still to be read, or null. `done` is the last verse index read in English.
 * Not the last verse: its timing can end before the recitation does, so it waits for the audio's end.
 */
export function verseToTranslate(timings: VerseTiming[], ms: number, done: number): number | null {
  const next = done + 1;
  return next < timings.length - 1 && ms >= timings[next].to ? next : null;
}

/**
 * Where the Arabic carries on after a verse's English, in seconds: a little before the verse's
 * end. Some timings end up to ~0.1 s after the next verse has begun (Shuraym, Sudais in Al-Fatihah),
 * so its first syllable would be split by the English; from here it is heard whole. Where the
 * timing is right this replays a moment of the pause between the verses.
 */
export const REWIND_AFTER_ENGLISH = 0.15;

export function resumeAfterEnglish(timing: VerseTiming, currentTime: number): number {
  return Math.max(timing.from / 1000, Math.min(currentTime, timing.to / 1000) - REWIND_AFTER_ENGLISH);
}

/** Audio file and verse timings for one surah by one reciter. */
export function loadRecitation(reciter: number, surah: number): Promise<Recitation> {
  const r = RECITERS.find((r) => r.id === reciter);
  if (r?.quranCentral) {
    return Promise.resolve({ url: `https://podcasts.qurancentral.com/${r.quranCentral}/${String(surah).padStart(3, '0')}.mp3`, timings: [] });
  }
  if (r?.archive) {
    return Promise.resolve({ url: `https://archive.org/download/${r.archive.item}/${encodeURIComponent(r.archive.files[surah - 1])}`, timings: [] });
  }
  if (r?.quranEnc) {
    const pad = (n: number) => String(n).padStart(3, '0');
    const tracks = Array.from({ length: SURAHS[surah - 1].verses }, (_, i) => {
      const file = `${pad(surah)}${pad(i + 1)}.mp3`;
      const translation = `https://d.quranenc.com/data/audio/${r.quranEnc}/${file}`;
      return r.everyAyah ? [`https://everyayah.com/data/${r.everyAyah}/${file}`, translation] : [translation];
    }).flat();
    if (!r.everyAyah) return Promise.resolve({ url: tracks[0], timings: [], tracks });
    return Promise.resolve({ url: tracks[0], timings: [], tracks, filesPerVerse: 2, translationVolume: r.translationVolume });
  }
  if (r?.islamicNetwork && r.verseByVerse) {
    const tracks = Array.from({ length: SURAHS[surah - 1].verses }, (_, i) => verseAudioUrl(r.islamicNetwork!, surah, i + 1));
    return Promise.resolve({ url: tracks[0], timings: [], tracks });
  }
  if (r?.islamicNetwork) {
    return Promise.resolve({ url: `https://cdn.islamic.network/quran/audio-surah/128/${r.islamicNetwork}/${surah}.mp3`, timings: [] });
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
      return { url: file.audio_url, timings: RECITERS.find((r) => r.id === reciter)?.timingsOff ? [] : timings };
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
