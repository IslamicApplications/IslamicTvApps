/**
 * App-wide colour themes, for the TV display.
 *
 * A palette sets CSS variables on :root (screen only): the background gradient (--bg-from/via/to),
 * six surface shades from the page (--s0) up to raised cards (--s5), the TV's tinted
 * panels (--tv-*), and Tailwind colours: the accent palette replaces amber, and the
 * light Parchment palette flips white/black, the neutral scale and the accents so
 * every existing `text-white`, `bg-white/10` or `text-amber-300` stays readable.
 */
import { useEffect, useLayoutEffect, useState } from 'react';
import { Mosque, MOSQUE_CHANGE_EVENT, calculateMosquePrayerTimes, getSelectedMosque } from './utils/prayerTimes';

export type ThemeId = 'timeofday' | 'daynight' | 'obsidian' | 'emerald' | 'sapphire' | 'royal-gold' | 'parchment';

export const THEMES: { id: ThemeId; label: string; swatch: string; description: string }[] = [
  { id: 'timeofday', label: 'Time of Day', swatch: 'linear-gradient(135deg, #18285a, #0a3431, #33210a, #3a1236, #090d18)', description: 'Follows the prayer times: dawn, day, Asr, Maghrib and night' },
  { id: 'daynight', label: 'Day & Night', swatch: 'linear-gradient(135deg, #f1e6cf 50%, #090d18 50%)', description: 'Parchment from sunrise to Maghrib, Obsidian at night' },
  { id: 'obsidian', label: 'Obsidian', swatch: '#090d18', description: '' },
  { id: 'emerald', label: 'Emerald', swatch: '#062016', description: '' },
  { id: 'sapphire', label: 'Sapphire', swatch: '#091630', description: '' },
  { id: 'royal-gold', label: 'Royal Gold', swatch: '#241a08', description: '' },
  { id: 'parchment', label: 'Parchment', swatch: '#f1e6cf', description: '' }
];

/** Tailwind v4 palettes (tailwindcss/theme.css) */
const P = {
  amber: ['98.7% 0.022 95.277', '96.2% 0.059 95.617', '92.4% 0.12 95.746', '87.9% 0.169 91.605', '82.8% 0.189 84.429', '76.9% 0.188 70.08', '66.6% 0.179 58.318', '55.5% 0.163 48.998', '47.3% 0.137 46.201', '41.4% 0.112 45.904', '27.9% 0.077 45.635'],
  yellow: ['98.7% 0.026 102.212', '97.3% 0.071 103.193', '94.5% 0.129 101.54', '90.5% 0.182 98.111', '85.2% 0.199 91.936', '79.5% 0.184 86.047', '68.1% 0.162 75.834', '55.4% 0.135 66.442', '47.6% 0.114 61.907', '42.1% 0.095 57.708', '28.6% 0.066 53.813'],
  emerald: ['97.9% 0.021 166.113', '95% 0.052 163.051', '90.5% 0.093 164.15', '84.5% 0.143 164.978', '76.5% 0.177 163.223', '69.6% 0.17 162.48', '59.6% 0.145 163.225', '50.8% 0.118 165.612', '43.2% 0.095 166.913', '37.8% 0.077 168.94', '26.2% 0.051 172.552'],
  sky: ['97.7% 0.013 236.62', '95.1% 0.026 236.824', '90.1% 0.058 230.902', '82.8% 0.111 230.318', '74.6% 0.16 232.661', '68.5% 0.169 237.323', '58.8% 0.158 241.966', '50% 0.134 242.749', '44.3% 0.11 240.79', '39.1% 0.09 240.876', '29.3% 0.066 243.157'],
  rose: ['96.9% 0.015 12.422', '94.1% 0.03 12.58', '89.2% 0.058 10.001', '81% 0.117 11.638', '71.2% 0.194 13.428', '64.5% 0.246 16.439', '58.6% 0.253 17.585', '51.4% 0.222 16.935', '45.5% 0.188 13.697', '41% 0.159 10.272', '27.1% 0.105 12.094'],
  orange: ['98% 0.016 73.684', '95.4% 0.038 75.164', '90.1% 0.076 70.697', '83.7% 0.128 66.29', '75% 0.183 55.934', '70.5% 0.213 47.604', '64.6% 0.222 41.116', '55.3% 0.195 38.402', '47% 0.157 37.304', '40.8% 0.123 38.172', '26.6% 0.079 36.259'],
  purple: ['97.7% 0.014 308.299', '94.6% 0.033 307.174', '90.2% 0.063 306.703', '82.7% 0.119 306.383', '71.4% 0.203 305.504', '62.7% 0.265 303.9', '55.8% 0.288 302.321', '49.6% 0.265 301.924', '43.8% 0.218 303.724', '38.1% 0.176 304.987', '29.1% 0.149 302.717'],
  teal: ['98.4% 0.014 180.72', '95.3% 0.051 180.801', '91% 0.096 180.426', '85.5% 0.138 181.071', '77.7% 0.152 181.912', '70.4% 0.14 182.503', '60% 0.118 184.704', '51.1% 0.096 186.391', '43.7% 0.078 188.216', '38.6% 0.063 188.416', '27.7% 0.046 192.524'],
  red: ['97.1% 0.013 17.38', '93.6% 0.032 17.717', '88.5% 0.062 18.334', '80.8% 0.114 19.571', '70.4% 0.191 22.216', '63.7% 0.237 25.331', '57.7% 0.245 27.325', '50.5% 0.213 27.518', '44.4% 0.177 26.899', '39.6% 0.141 25.723', '25.8% 0.092 26.042']
} as const;
type PaletteName = keyof typeof P;
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

interface Palette {
  /** Background gradient: from, via, to */
  bg: [string, string, string];
  /** Surfaces, darkest (page) to most raised (on light: page to deepest tint) */
  s: [string, string, string, string, string, string];
  /** Replaces amber; null keeps amber */
  accent: PaletteName | null;
  /** Islamic pattern and ornaments */
  pattern: string;
  light?: boolean;
}

const PALETTES = {
  obsidian: { bg: ['#06080e', '#090d18', '#040508'], s: ['#090b10', '#0e111a', '#11131c', '#151824', '#1a1f30', '#22293d'], accent: null, pattern: '#d4af37' },
  emerald: { bg: ['#03140e', '#062016', '#020a07'], s: ['#04120c', '#061a13', '#081f17', '#0b2a1f', '#0f2e22', '#143a2b'], accent: 'emerald', pattern: '#10b981' },
  sapphire: { bg: ['#050e1f', '#091630', '#030710'], s: ['#060c1a', '#081226', '#0a162d', '#0e1d3c', '#12254a', '#183060'], accent: 'sky', pattern: '#38bdf8' },
  'royal-gold': { bg: ['#191206', '#241a08', '#0d0903'], s: ['#120d04', '#1c1407', '#21180a', '#261c0b', '#33260f', '#3d2d12'], accent: 'yellow', pattern: '#fbbf24' },
  parchment: { bg: ['#f7f0e1', '#f1e6cf', '#eadbbd'], s: ['#f3ead8', '#fbf6ec', '#fffaf1', '#f7efdf', '#efe4cc', '#e7d8b9'], accent: null, pattern: '#b8892b', light: true },
  // Time of day
  dawn: { bg: ['#0a1230', '#18285a', '#070c22'], s: ['#0a1028', '#0e1634', '#111a3c', '#16214a', '#1c2a5a', '#24346c'], accent: 'sky', pattern: '#93c5fd' },
  day: { bg: ['#05211f', '#0a3431', '#031615'], s: ['#041a19', '#072421', '#092a27', '#0c3330', '#103e3a', '#154a45'], accent: 'emerald', pattern: '#5eead4' },
  asr: { bg: ['#211505', '#33210a', '#140c02'], s: ['#170f03', '#1f1606', '#251a08', '#2d200a', '#3a2a0e', '#473413'], accent: 'yellow', pattern: '#fcd34d' },
  dusk: { bg: ['#22091f', '#3a1236', '#130511'], s: ['#1a0718', '#240a21', '#2a0d27', '#331131', '#3f163c', '#4c1b49'], accent: null, pattern: '#f9a8d4' },
  // Ramadan nights: deeper indigo
  ramadanNight: { bg: ['#07082a', '#11134a', '#04051a'], s: ['#06071f', '#0a0c2c', '#0d0f34', '#121540', '#181b50', '#1f2360'], accent: null, pattern: '#fcd34d' }
} satisfies Record<string, Palette>;
type PaletteKey = keyof typeof PALETTES;

/** Shade s of a palette as an oklch() colour */
const shade = (name: PaletteName, s: number) => `oklch(${P[name][SHADES.indexOf(s)]})`;

/** Parchment text and accents: the dark end of each scale where the light end was used */
const LIGHT_SWAP: Record<number, number> = { 50: 950, 100: 900, 200: 900, 300: 800, 400: 700, 500: 500, 600: 500, 700: 300, 800: 200, 900: 100, 950: 50 };
/** Parchment neutrals (warm): text shades darken, background shades lighten; 950 stays dark (text on accent buttons) */
const LIGHT_NEUTRAL: Record<number, string> = {
  50: 'oklch(22% 0.02 60)', 100: 'oklch(25% 0.022 60)', 200: 'oklch(30% 0.022 60)', 300: 'oklch(36% 0.022 60)',
  400: 'oklch(47% 0.02 60)', 500: 'oklch(56% 0.018 60)', 600: 'oklch(66% 0.016 70)', 700: 'oklch(76% 0.016 75)',
  800: 'oklch(85% 0.018 80)', 900: 'oklch(91% 0.02 82)', 950: 'oklch(20% 0.02 60)'
};

function paletteVariables(p: Palette): Record<string, string> {
  const vars: Record<string, string> = {
    '--bg-from': p.bg[0],
    '--bg-via': p.bg[1],
    '--bg-to': p.bg[2],
    '--pattern': p.pattern,
    'color-scheme': p.light ? 'light' : 'dark'
  };
  p.s.forEach((c, i) => (vars[`--s${i}`] = c));
  // TV panels, from the surfaces
  Object.assign(vars, {
    '--tv-panel': `color-mix(in srgb, ${p.s[1]} 80%, transparent)`,
    '--tv-card': `color-mix(in srgb, ${p.s[2]} 80%, transparent)`,
    '--tv-strip': p.s[2],
    '--tv-dialog': p.s[2],
    '--tv-hero-mid': p.s[4],
    '--tv-hero-end': p.s[2],
    '--tv-next-mid': p.s[5],
    '--tv-next-end': p.s[3]
  });

  const accent = p.accent ?? 'amber';
  for (const s of SHADES) {
    const from = p.light ? LIGHT_SWAP[s] : s;
    vars[`--color-amber-${s}`] = shade(accent, from);
    if (p.light) {
      for (const name of ['emerald', 'sky', 'rose', 'orange', 'purple', 'teal', 'red', 'yellow'] as const) {
        vars[`--color-${name}-${s}`] = shade(name, from);
      }
      vars[`--color-neutral-${s}`] = LIGHT_NEUTRAL[s];
    }
  }
  if (p.light) {
    vars['--color-white'] = 'oklch(24% 0.025 55)';
    vars['--color-black'] = 'oklch(97% 0.015 85)';
  }
  return vars;
}

export type DayPhase = 'dawn' | 'day' | 'asr' | 'dusk' | 'night';

/**
 * Part of the day at the mosque: dawn from Fajr until 30 minutes after sunrise, day
 * until Asr, Asr until Maghrib, dusk until Isha, night until Fajr.
 */
export function dayPhase(minutes: number, adhan: { Fajr: number; Sunrise: number; Asr: number; Maghrib: number; Isha: number }): DayPhase {
  if (minutes < adhan.Fajr || minutes >= adhan.Isha) return 'night';
  if (minutes < adhan.Sunrise + 30) return 'dawn';
  if (minutes < adhan.Asr) return 'day';
  if (minutes < adhan.Maghrib) return 'asr';
  return 'dusk';
}

/** The palette a theme shows at this moment. */
export function resolvePalette(theme: ThemeId, phase: DayPhase, isRamadan: boolean): PaletteKey {
  if (theme === 'timeofday') return phase === 'night' ? (isRamadan ? 'ramadanNight' : 'obsidian') : phase;
  if (theme === 'daynight') {
    if (phase === 'day' || phase === 'asr') return 'parchment';
    return isRamadan && phase === 'night' ? 'ramadanNight' : 'obsidian';
  }
  return theme;
}

export function themeVariables(key: PaletteKey): Record<string, string> {
  return paletteVariables(PALETTES[key]);
}

export function isLightPalette(key: PaletteKey): boolean {
  return !!(PALETTES[key] as Palette).light;
}

const THEME_KEY = 'daily_hadith_theme';
const OLD_TV_THEME_KEY = 'daily_hadith_tv_theme';
export const THEME_EVENT = 'app-theme-change';

export function getTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(THEME_KEY) ?? localStorage.getItem(OLD_TV_THEME_KEY);
    if (THEMES.some((t) => t.id === saved)) return saved as ThemeId;
  } catch {}
  return 'obsidian';
}

export function saveTheme(theme: ThemeId): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function nextTheme(current: ThemeId): ThemeId {
  const ids = THEMES.map((t) => t.id);
  return ids[(ids.indexOf(current) + 1) % ids.length];
}

function currentPalette(theme: ThemeId, mosque: Mosque): { key: PaletteKey; isRamadan: boolean } {
  const r = calculateMosquePrayerTimes(mosque, new Date());
  const [h, m] = r.localTime24.split(':').map(Number);
  const sunrise = (() => {
    const [, hh, mm, ap] = r.sunrise.match(/(\d+):(\d+) (AM|PM)/) ?? [];
    return ((Number(hh) % 12) + (ap === 'PM' ? 12 : 0)) * 60 + Number(mm);
  })();
  const phase = dayPhase(h * 60 + m, { ...r.adhanMinutes, Sunrise: sunrise });
  return { key: resolvePalette(theme, phase, r.isRamadan), isRamadan: r.isRamadan };
}

/**
 * The chosen theme, applied to the whole page (dialogs and pop-ups included).
 * Time-based themes follow the selected mosque's prayer times, checked every 30 s.
 */
export function useAppTheme(): { theme: ThemeId; setTheme: (t: ThemeId) => void; palette: PaletteKey; isRamadan: boolean } {
  const [theme, setThemeState] = useState<ThemeId>(getTheme);
  const [state, setState] = useState(() => currentPalette(getTheme(), getSelectedMosque()));

  useEffect(() => {
    const sync = () => {
      const t = getTheme();
      setThemeState(t);
      setState(currentPalette(t, getSelectedMosque()));
    };
    const timer = setInterval(sync, 30000);
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener(MOSQUE_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      clearInterval(timer);
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener(MOSQUE_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useLayoutEffect(() => {
    // Screen only: printing (the monthly timetable) keeps the standard colours
    let style = document.getElementById('app-theme') as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = 'app-theme';
      document.head.appendChild(style);
    }
    const declarations = Object.entries(themeVariables(state.key)).map(([name, value]) => `${name}: ${value};`).join(' ');
    style.textContent = `@media screen { :root { ${declarations} } }`;
    document.documentElement.dataset.theme = isLightPalette(state.key) ? 'light' : 'dark';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', PALETTES[state.key].s[0]);
  }, [state.key]);

  return { theme, setTheme: saveTheme, palette: state.key, isRamadan: state.isRamadan };
}

/** The chosen theme for a picker, kept in step with every other picker and the applied theme. */
export function useThemeChoice(): [ThemeId, (t: ThemeId) => void] {
  const [theme, setThemeState] = useState<ThemeId>(getTheme);
  useEffect(() => {
    const sync = () => setThemeState(getTheme());
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return [theme, saveTheme];
}
