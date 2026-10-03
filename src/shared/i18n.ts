import { useEffect } from 'react';
import { HadithLanguage, getUiLanguage, useUiLanguage } from './hooks/useHadithLanguage';
import { AR } from './i18n.ar';

/**
 * Interface language: the same English / العربية choice as the Hadith text, so one
 * switch changes the whole app. Strings are looked up by their English text; anything
 * without an Arabic entry stays in English.
 */

export type Language = HadithLanguage;

type Vars = Record<string, string | number>;

export function translate(language: Language, text: string, vars?: Vars): string {
  const template = language === 'ar' ? (AR[text] ?? text) : text;
  const result = vars ? template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`)) : template;
  return language === 'ar' ? toArabicDigits(result) : result;
}

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** "04:22" -> "٤:٢٢", "40%" -> "٤٠٪" (Arabic-Indic numerals for the Arabic interface) */
export function toArabicDigits(text: string): string {
  return text
    // No leading zeros ("04:22" -> "4:22", "-02" -> "-2"); minutes and seconds keep theirs (":05")
    .replace(/(^|[^0-9:.])0+([0-9])/g, '$1$2')
    .replace(/[0-9]/g, (d) => ARABIC_DIGITS[Number(d)])
    .replace(/%/g, '٪');
}

function toLatinDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d))).replace(/٪/g, '%');
}

/**
 * Arabic numerals across the whole page while the interface is Arabic. Numbers are
 * rendered in many places (times, dates, counters, references), so text on screen
 * is converted as it appears; the nodes changed are remembered and switched back
 * to Western digits when the language returns to English.
 */
const convertedNodes = new Set<Text>();
let digitObserver: MutationObserver | null = null;

function convertTextNode(node: Text): void {
  const parent = node.parentElement;
  if (!parent || parent.closest('script, style, [data-latin-digits]')) return;
  const value = node.nodeValue ?? '';
  if (!/[0-9%]/.test(value)) return;
  node.nodeValue = toArabicDigits(value);
  convertedNodes.add(node);
  // Forget text that has left the page (a TV can run for days)
  if (convertedNodes.size > 5000) {
    for (const n of convertedNodes) if (!n.isConnected) convertedNodes.delete(n);
  }
}

function convertTree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) return convertTextNode(root as Text);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) convertTextNode(n as Text);
}

function setArabicDigits(on: boolean): void {
  if (on) {
    if (digitObserver) return;
    convertTree(document.body);
    digitObserver = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'characterData') convertTextNode(r.target as Text);
        else r.addedNodes.forEach(convertTree);
      }
    });
    digitObserver.observe(document.body, { subtree: true, childList: true, characterData: true });
  } else {
    digitObserver?.disconnect();
    digitObserver = null;
    for (const node of convertedNodes) {
      if (node.isConnected && node.nodeValue) node.nodeValue = toLatinDigits(node.nodeValue);
    }
    convertedNodes.clear();
  }
}

const PRAYERS_AR: Record<string, string> = {
  Fajr: 'الفجر',
  Sunrise: 'الشروق',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء',
  "Jumu'ah": 'الجمعة',
  Suhoor: 'السحور',
  Iftar: 'الإفطار'
};

export const HIJRI_MONTHS_AR = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة'
];

const HIJRI_MONTHS_EN = [
  'Muharram',
  'Safar',
  'Rabiʻ I',
  'Rabiʻ II',
  'Jumada I',
  'Jumada II',
  'Rajab',
  'Shaʻban',
  'Ramadan',
  'Shawwal',
  'Dhuʻl-Qiʻdah',
  'Dhuʻl-Hijjah'
];

const COLLECTIONS_AR: Record<string, string> = {
  'Sahih al-Bukhari': 'صحيح البخاري',
  'Sahih Muslim': 'صحيح مسلم',
  'Sunan Abi Dawud': 'سنن أبي داود',
  'Jami` at-Tirmidhi': 'جامع الترمذي',
  "Sunan an-Nasa'i": 'سنن النسائي',
  'Sunan Ibn Majah': 'سنن ابن ماجه',
  'Muwatta Malik': 'موطأ مالك',
  'Musnad Ahmad': 'مسند أحمد',
  'Sunan ad-Darimi': 'سنن الدارمي',
  'Riyad as-Salihin': 'رياض الصالحين',
  "Ash-Shama'il Al-Muhammadiyah": 'الشمائل المحمدية',
  'Bulugh al-Maram': 'بلوغ المرام',
  'Al-Adab Al-Mufrad': 'الأدب المفرد',
  'Mishkat al-Masabih': 'مشكاة المصابيح',
  'The Forty Hadith of an-Nawawi': 'الأربعون النووية',
  'Forty Hadith Qudsi': 'الأربعون القدسية',
  'Forty Hadith of Shah Waliullah': 'أربعون الشاه ولي الله',
  'sunnah.com': 'sunnah.com'
};

/** "04:24 AM" -> "04:24 ص" */
export function formatTime(language: Language, time: string): string {
  if (language !== 'ar') return time;
  return time.replace(/\s?AM\b/gi, ' ص').replace(/\s?PM\b/gi, ' م');
}

/** "6h 14m" / "5m 3s" -> "6س 14د" / "5د 3ث" */
export function formatDuration(language: Language, text: string): string {
  if (language !== 'ar') return text;
  return text.replace(/(\d+)h\b/g, '$1 س').replace(/(\d+)m\b/g, '$1 د').replace(/(\d+)s\b/g, '$1 ث');
}

export function prayerName(language: Language, name: string): string {
  return language === 'ar' ? (PRAYERS_AR[name] ?? name) : name;
}

export function collectionName(language: Language, name: string): string {
  if (language !== 'ar') return name;
  return COLLECTIONS_AR[name] ?? name;
}

/** "20 Rabiʻ II 1448 AH" -> "20 ربيع الآخر 1448 هـ" */
export function formatHijri(language: Language, formatted: string): string {
  if (language !== 'ar') return formatted;
  const byLength = HIJRI_MONTHS_EN.map((name, i) => ({ name, i })).sort((a, b) => b.name.length - a.name.length);
  // Longest names first so "Rabiʻ II" isn't read as "Rabiʻ I"; every month in the text
  const pattern = new RegExp(byLength.map(({ name }) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  const result = formatted
    .replace(/\bAH\b/g, 'هـ')
    .replace(pattern, (name) => HIJRI_MONTHS_AR[HIJRI_MONTHS_EN.indexOf(name)]);
  return result;
}

export function hijriMonthName(language: Language, englishName: string): string {
  if (language !== 'ar') return englishName;
  const i = HIJRI_MONTHS_EN.indexOf(englishName);
  return i >= 0 ? HIJRI_MONTHS_AR[i] : englishName;
}

/** Gregorian date in the interface language (Western digits in Arabic, as used in Australia). */
export function formatDate(language: Language, date: Date, options: Intl.DateTimeFormatOptions): string {
  const locale = language === 'ar' ? 'ar-u-nu-latn' : 'en-AU';
  try {
    return date.toLocaleDateString(locale, options);
  } catch {
    return date.toLocaleDateString(undefined, options);
  }
}

export interface I18n {
  language: Language;
  isArabic: boolean;
  dir: 'rtl' | 'ltr';
  t: (text: string, vars?: Vars) => string;
  time: (time: string) => string;
  duration: (text: string) => string;
  prayer: (name: string) => string;
  collection: (name: string) => string;
  hijri: (formatted: string) => string;
  date: (date: Date, options: Intl.DateTimeFormatOptions) => string;
}

export function makeI18n(language: Language): I18n {
  return {
    language,
    isArabic: language === 'ar',
    dir: language === 'ar' ? 'rtl' : 'ltr',
    t: (text, vars) => translate(language, text, vars),
    time: (time) => formatTime(language, time),
    duration: (text) => formatDuration(language, text),
    prayer: (name) => prayerName(language, name),
    collection: (name) => collectionName(language, name),
    hijri: (formatted) => formatHijri(language, formatted),
    date: (date, options) => formatDate(language, date, options)
  };
}

/** Translation helpers for the chosen language; re-renders when it changes. */
export function useI18n(): I18n {
  const language = useUiLanguage();
  return makeI18n(language);
}

/** For code outside React (notifications, document title, spoken text). */
export function currentI18n(): I18n {
  return makeI18n(getUiLanguage());
}

let originalTitle = '';

/** Keeps <html lang dir> and the page title in step with the chosen language (right-to-left for Arabic). */
export function useDocumentLanguage(): void {
  const language = useUiLanguage();
  useEffect(() => {
    document.documentElement.lang = language === 'ar' ? 'ar' : 'en';
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    if (!originalTitle) originalTitle = document.title;
    document.title = language === 'ar' ? translate('ar', originalTitle) : originalTitle;
    setArabicDigits(language === 'ar');
  }, [language]);
}
