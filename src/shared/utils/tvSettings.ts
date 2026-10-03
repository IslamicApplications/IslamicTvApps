/** How long each Hadith stays on the TV screen before the next one slides in. 0 = paused. */
export const SLIDE_SPEEDS = [10, 15, 25, 45, 60, 120, 300, 0] as const;
export type SlideSeconds = (typeof SLIDE_SPEEDS)[number];

const STORAGE_KEY = 'daily_hadith_tv_slide_seconds';
const DEFAULT_SECONDS: SlideSeconds = 25;

export function getSlideSeconds(): SlideSeconds {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const seconds = SLIDE_SPEEDS.find((s) => String(s) === saved);
    if (seconds !== undefined) return seconds;
  } catch {
    // Storage blocked: use the default
  }
  return DEFAULT_SECONDS;
}

export function saveSlideSeconds(seconds: SlideSeconds): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(seconds));
  } catch {
    // Storage blocked: the choice still applies until the page is reloaded
  }
}

export function nextSlideSeconds(current: SlideSeconds): SlideSeconds {
  return SLIDE_SPEEDS[(SLIDE_SPEEDS.indexOf(current) + 1) % SLIDE_SPEEDS.length];
}

export function describeSlideSeconds(seconds: SlideSeconds): string {
  if (seconds === 0) return 'Paused';
  return seconds < 60 ? `${seconds} sec` : `${seconds / 60} min`;
}

/** TV screen brightness in percent. Pages can't change the TV's backlight, so lower levels dim the picture. */
/** 'auto' = full by day, dimmed at night (after Isha until before Fajr) */
export const BRIGHTNESS_LEVELS = [100, 85, 70, 55, 40, 25, 'auto'] as const;
export type BrightnessLevel = (typeof BRIGHTNESS_LEVELS)[number];

const BRIGHTNESS_KEY = 'daily_hadith_tv_brightness';

export function getTvBrightness(): BrightnessLevel {
  try {
    const saved = localStorage.getItem(BRIGHTNESS_KEY);
    const level = BRIGHTNESS_LEVELS.find((b) => String(b) === saved);
    if (level !== undefined) return level;
  } catch {
    // Storage blocked: use full brightness
  }
  return 100;
}

export function saveTvBrightness(level: BrightnessLevel): void {
  try {
    localStorage.setItem(BRIGHTNESS_KEY, String(level));
  } catch {
    // Storage blocked: the choice still applies until the page is reloaded
  }
}

export function nextTvBrightness(current: BrightnessLevel): BrightnessLevel {
  return BRIGHTNESS_LEVELS[(BRIGHTNESS_LEVELS.indexOf(current) + 1) % BRIGHTNESS_LEVELS.length];
}

const TOPIC_KEY = 'daily_hadith_tv_topic';

/** Topic the TV's Hadith slides come from; null = the whole library. */
export function getTvTopic(): string | null {
  try {
    return localStorage.getItem(TOPIC_KEY) || null;
  } catch {
    return null;
  }
}

export function saveTvTopic(topic: string | null): void {
  try {
    if (topic) localStorage.setItem(TOPIC_KEY, topic);
    else localStorage.removeItem(TOPIC_KEY);
  } catch {}
}
