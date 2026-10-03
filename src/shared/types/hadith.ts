export interface Hadith {
  id: string;
  collection: string; // "Sahih al-Bukhari"
  volume: number;
  bookNumber: number;
  bookName: string;
  /** Arabic book name (sunnah.com library), for the Arabic interface */
  bookNameAr?: string;
  hadithNumber: string;
  narrator: string;
  text: string;
  excerpt: string;
  isLong: boolean;
  wordCount: number;
  startPage: number;
  endPage: number;
  sourceUrl: string;
  pdfPage: number;
  /** 'sunnah.com' for the daily library; absent for the Bukhari PDF edition */
  source?: 'sunnah.com';
  /** sunnah.com collection slug, e.g. "muslim" */
  collectionSlug?: string;
  /** sunnah.com's in-book reference, e.g. "In-book reference: Book 12, Hadith 102" */
  reference?: string;
  /** True when sunnah.com has no English translation and `text` is the Arabic */
  isArabic?: boolean;
  /** Position within its sunnah.com collection, used to fetch the Arabic text */
  localIndex?: number;
  /** Authenticity grade; absent when the collection has no grades */
  grade?: HadithGrade;
}

export type GradeCategory = 'sahih' | 'hasan' | 'daif' | 'fabricated' | 'other';

export interface HadithGrade {
  /** e.g. "Sahih", "Hasan Sahih", "Daʻif Isnad" */
  text: string;
  category: GradeCategory;
  /** e.g. "Al-Albani", or the collection for Bukhari and Muslim */
  by: string;
}

export interface BookMeta {
  bookNumber: number;
  bookName: string;
  hadithCount: number;
}

export interface DailySelection {
  dateString: string; // YYYY-MM-DD
  hadith: Hadith;
  index: number;
  hijriDate: string;
}

export interface ScreensaverConfig {
  brightness: number; // 20 to 100
  fontSize: 'small' | 'medium' | 'large' | 'huge';
  showClock: boolean;
  clockFormat: '12h' | '24h';
  showDate: boolean;
  showHijri: boolean;
  patternOpacity: number; // 0 to 100
  driftEnabled: boolean;
  driftIntervalSeconds: number;
}

export interface FavoriteItem {
  hadithId: string;
  hadith: Hadith;
  savedAt: string;
  notes?: string;
}

export interface ReminderConfig {
  enabled: boolean;
  time: string; // "07:00"
  hasPermission: boolean;
}
