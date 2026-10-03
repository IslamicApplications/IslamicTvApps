import { useEffect, useState } from 'react';
import { Hadith } from '../types/hadith';
import { loadArabicText, peekArabicText, withArabicText } from '../utils/hadithLibrary';

export type HadithLanguage = 'en' | 'ar';

const STORAGE_KEY = 'daily_hadith_language';
const CHANGE_EVENT = 'hadith-language-change';

export function getHadithLanguage(): HadithLanguage {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

export function setHadithLanguage(language: HadithLanguage): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage blocked: the choice still applies until the page is reloaded
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: language }));
}

/** The chosen Hadith language, kept in sync across every view that uses it. */
export function useHadithLanguage(): [HadithLanguage, (language: HadithLanguage) => void] {
  const [language, setLanguage] = useState<HadithLanguage>(getHadithLanguage);
  useEffect(() => {
    const onChange = (e: Event) => setLanguage((e as CustomEvent<HadithLanguage>).detail);
    const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && setLanguage(getHadithLanguage());
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return [language, setHadithLanguage];
}

/**
 * Interface (screen) language. On the phone it is the same as the Hadith language;
 * on the TV it can be chosen separately (an Arabic Hadith on an English screen, or
 * the other way round); it starts as the language the TV already had.
 */
const UI_KEY = 'daily_hadith_tv_ui_language';
const UI_EVENT = 'ui-language-change';
let separateUiLanguage = false;

/** Called by the TV app before it renders. */
export function enableSeparateUiLanguage(): void {
  separateUiLanguage = true;
  // Start from the current language, then the two are independent
  try {
    if (!localStorage.getItem(UI_KEY)) localStorage.setItem(UI_KEY, getHadithLanguage());
  } catch {}
}

export function getUiLanguage(): HadithLanguage {
  if (separateUiLanguage) {
    try {
      const saved = localStorage.getItem(UI_KEY);
      if (saved === 'ar' || saved === 'en') return saved;
    } catch {}
  }
  return getHadithLanguage();
}

export function setUiLanguage(language: HadithLanguage): void {
  try {
    localStorage.setItem(UI_KEY, language);
  } catch {}
  window.dispatchEvent(new CustomEvent(UI_EVENT, { detail: language }));
}

/** The interface language, updated when either choice changes. */
export function useUiLanguage(): HadithLanguage {
  const [language, setLanguage] = useState<HadithLanguage>(getUiLanguage);
  useEffect(() => {
    const sync = () => setLanguage(getUiLanguage());
    window.addEventListener(UI_EVENT, sync);
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(UI_EVENT, sync);
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return language;
}

/**
 * The Hadith as it should be displayed in the chosen language. In Arabic mode the
 * English is shown until the Arabic has loaded, and stays when there is no Arabic
 * (the bundled offline Bukhari collection); `arabicUnavailable` is then true.
 */
export function useDisplayedHadith<T extends Hadith | null>(hadith: T): { hadith: T; language: HadithLanguage; arabicUnavailable: boolean } {
  const [language] = useHadithLanguage();
  const [arabic, setArabic] = useState<{ id: string; text: string | null } | null>(null);
  const id = hadith?.id;

  useEffect(() => {
    if (!hadith || language !== 'ar') return;
    let cancelled = false;
    loadArabicText(hadith)
      .then((text) => !cancelled && setArabic({ id: hadith.id, text }))
      .catch(() => !cancelled && setArabic({ id: hadith.id, text: null }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, language]);

  if (!hadith || language !== 'ar') return { hadith, language, arabicUnavailable: false };
  // Already downloaded (the TV fetches it before changing slide): no English in between
  const known = peekArabicText(hadith);
  if (known) return { hadith: withArabicText(hadith, known) as T, language, arabicUnavailable: false };
  if (known === null) return { hadith, language, arabicUnavailable: true };
  if (arabic?.id === hadith.id && arabic.text) return { hadith: withArabicText(hadith, arabic.text) as T, language, arabicUnavailable: false };
  return { hadith, language, arabicUnavailable: arabic?.id === hadith.id };
}
