/**
 * Authentic Muezzin Vocal Audio & Azan Controller
 * Integrated with Islamic Network API (https://islamic.network/api/)
 */

import { SITE_ROOT } from './siteRoot';

export type MuezzinId = 'makkah' | 'madinah' | 'alafasy' | 'alaqsa' | 'abdulbasit' | 'chime';

export type AzanPrayer = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

export const AZAN_PRAYERS: AzanPrayer[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export interface AzanSettings {
  autoAzanEnabled: boolean;
  /** Default voice for every prayer without its own choice */
  selectedMuezzin: MuezzinId;
  /** Optional voice per prayer; a prayer left out uses selectedMuezzin */
  prayerMuezzins?: Partial<Record<AzanPrayer, MuezzinId>>;
  volume: number; // 0.1 to 1.0
  notifyBrowser: boolean;
  /** TV: play the Iqamah when the Iqamah countdown ends (on unless turned off) */
  iqamahSound?: boolean;
  lastPlayedPrayerKey?: string;
}

const AZAN_SETTINGS_KEY = 'daily_hadith_azan_settings_v2';

export const DEFAULT_AZAN_SETTINGS: AzanSettings = {
  autoAzanEnabled: true,
  selectedMuezzin: 'makkah',
  volume: 0.95,
  notifyBrowser: true
};

const cleanBase = SITE_ROOT;

export const MUEZZIN_SOURCES: Record<MuezzinId, { name: string; subtitle: string; location: string; url: string }> = {
  makkah: {
    name: 'Makkah Al-Mukarramah',
    subtitle: 'Sheikh Ali Ahmed Mulla (Grand Mosque Chief Muezzin)',
    location: 'Masjid al-Haram, Makkah',
    url: `${cleanBase}audio/adhan_makkah.mp3`
  },
  madinah: {
    name: 'Al-Madinah Al-Munawwarah',
    subtitle: 'Sheikh Essam Bukhari (Prophet\'s Mosque Muezzin)',
    location: 'Masjid an-Nabawi, Madinah',
    url: `${cleanBase}audio/adhan_madinah.mp3`
  },
  alafasy: {
    name: 'Mishary Rashid Alafasy',
    subtitle: 'Sheikh Mishary Rashid Alafasy',
    location: 'Grand Mosque, Kuwait',
    url: `${cleanBase}audio/adhan_alafasy.mp3`
  },
  alaqsa: {
    name: 'Masjid Al-Aqsa (Jerusalem)',
    subtitle: 'Sheikh Najee Qazaz (Al-Aqsa Muezzin)',
    location: 'Al-Aqsa Mosque, Jerusalem',
    url: `${cleanBase}audio/adhan_alaqsa.mp3`
  },
  abdulbasit: {
    name: 'Sheikh Abdul Basit Abdul Samad',
    subtitle: 'Classic Historic Egyptian Adhan',
    location: 'Cairo, Egypt',
    url: `${cleanBase}audio/adhan_abdulbasit.mp3`
  },
  chime: {
    name: 'Gentle Acoustic Adhan Chime',
    subtitle: 'Harmonic 4-Tone Melodic Chime',
    location: 'Acoustic Synthesizer',
    url: ''
  }
};

/** The Iqamah the TV plays at Iqamah time. */
export const IQAMAH_SOURCE = {
  name: 'Iqamah of Masjid al-Haram',
  location: 'Masjid al-Haram, Makkah',
  url: `${cleanBase}audio/iqamah_makkah.mp3`
};

function isMuezzinId(value: unknown): value is MuezzinId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MUEZZIN_SOURCES, value);
}

export function getAzanSettings(): AzanSettings {
  try {
    const raw = localStorage.getItem(AZAN_SETTINGS_KEY);
    const settings: AzanSettings = raw ? { ...DEFAULT_AZAN_SETTINGS, ...JSON.parse(raw) } : DEFAULT_AZAN_SETTINGS;
    // Unknown or corrupted voice ids fall back to the Makkah default
    if (!isMuezzinId(settings.selectedMuezzin)) settings.selectedMuezzin = DEFAULT_AZAN_SETTINGS.selectedMuezzin;
    return settings;
  } catch {
    return DEFAULT_AZAN_SETTINGS;
  }
}

/** The voice that plays for a given prayer: its own choice, else the default (Makkah unless changed). */
export function getMuezzinForPrayer(settings: AzanSettings, prayer: string): MuezzinId {
  const own = settings.prayerMuezzins?.[prayer as AzanPrayer];
  if (isMuezzinId(own)) return own;
  return isMuezzinId(settings.selectedMuezzin) ? settings.selectedMuezzin : DEFAULT_AZAN_SETTINGS.selectedMuezzin;
}

/** Sets (or, with null, clears back to the default voice) the voice for one prayer. */
export function withPrayerMuezzin(settings: AzanSettings, prayer: AzanPrayer, muezzin: MuezzinId | null): AzanSettings {
  const prayerMuezzins = { ...settings.prayerMuezzins };
  if (muezzin) prayerMuezzins[prayer] = muezzin;
  else delete prayerMuezzins[prayer];
  return { ...settings, prayerMuezzins };
}

export function saveAzanSettings(settings: AzanSettings): void {
  // lastPlayedPrayerKey is tracked separately so stale settings copies can't roll it back
  const { lastPlayedPrayerKey, ...rest } = settings;
  try {
    localStorage.setItem(AZAN_SETTINGS_KEY, JSON.stringify(rest));
  } catch {}
}

const LAST_PLAYED_KEY = 'daily_hadith_azan_last_played_v1';

/**
 * Marks a prayer as played. Returns false if it was already claimed,
 * so the same Azan can never be triggered twice.
 */
export function claimAzanTrigger(triggerKey: string): boolean {
  try {
    if (localStorage.getItem(LAST_PLAYED_KEY) === triggerKey) return false;
    localStorage.setItem(LAST_PLAYED_KEY, triggerKey);
  } catch {}
  return true;
}

const IQAMAH_LAST_PLAYED_KEY = 'daily_hadith_iqamah_last_played_v1';

/** Like claimAzanTrigger, for the Iqamah: each prayer's Iqamah plays once. */
export function claimIqamahTrigger(triggerKey: string): boolean {
  try {
    if (localStorage.getItem(IQAMAH_LAST_PLAYED_KEY) === triggerKey) return false;
    localStorage.setItem(IQAMAH_LAST_PLAYED_KEY, triggerKey);
  } catch {}
  return true;
}

let activeAudio: HTMLAudioElement | null = null;
let audioContextInstance: AudioContext | null = null;
let chimeOscillators: OscillatorNode[] = [];
let chimeEndTimer: ReturnType<typeof setTimeout> | null = null;
// Increases with every playAzan() call, so a caller can tell whether its own Azan is still the one playing
let playCount = 0;

export function getAzanPlayCount(): number {
  return playCount;
}

// One reusable player for every Azan. iOS only lets a page start audio on an
// element that was first played during a tap, so this element is unlocked once
// (see unlockAudio) and then reused for the automatic Azan.
let azanElement: HTMLAudioElement | null = null;
const SILENT_WAV = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

function getAzanElement(): HTMLAudioElement {
  if (!azanElement) {
    azanElement = new Audio();
    azanElement.preload = 'auto';
  }
  return azanElement;
}

/**
 * Plays the selected muezzin's Azan.
 * If the browser blocks sound because nobody has tapped the page yet, onBlocked is
 * called (so the app can offer a "Tap to play" button) instead of playing a substitute.
 */
export function playAzan(
  onStart?: () => void,
  onEnd?: () => void,
  muezzinKey?: MuezzinId,
  onBlocked?: () => void
): boolean {
  stopAzan();
  playCount += 1;
  const thisPlay = playCount;

  const settings = getAzanSettings();
  const selectedKey = muezzinKey || getMuezzinForPrayer(settings, '');

  if (selectedKey === 'chime') {
    playAcousticAdhanChime(onEnd);
    if (onStart) onStart();
    return true;
  }

  const source = MUEZZIN_SOURCES[selectedKey] || MUEZZIN_SOURCES.makkah;

  try {
    const audio = getAzanElement();
    const isCurrent = () => playCount === thisPlay && activeAudio === audio;
    audio.muted = false;
    audio.src = source.url;
    audio.volume = Math.max(0.1, Math.min(1.0, settings.volume));

    audio.onplay = () => {
      if (isCurrent() && onStart) onStart();
    };

    audio.onended = () => {
      if (!isCurrent()) return;
      activeAudio = null;
      if (onEnd) onEnd();
    };

    // Both onerror and the play() rejection can fire for one failure; handle it once
    let failed = false;
    const fallBackToChime = (reason: unknown) => {
      if (failed || !isCurrent()) return;
      failed = true;
      console.warn('Azan audio unavailable, falling back to harmonic chime:', reason);
      activeAudio = null;
      playAcousticAdhanChime(onEnd);
      if (onStart) onStart();
    };

    audio.onerror = (e) => fallBackToChime(e);

    activeAudio = audio;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // AbortError means stopAzan() or a newer Azan interrupted it on purpose
        if (err?.name === 'AbortError') return;
        if (err?.name === 'NotAllowedError' && onBlocked) {
          if (failed || !isCurrent()) return;
          failed = true;
          activeAudio = null;
          onBlocked();
          return;
        }
        fallBackToChime(err);
      });
    }

    return true;
  } catch (err) {
    console.warn('Azan audio play exception:', err);
    playAcousticAdhanChime(onEnd);
    if (onStart) onStart();
    return true;
  }
}

/**
 * Plays the Iqamah on the same (already unlocked) player as the Azan, so it counts
 * as an Azan for isAzanPlaying() and stopAzan(). No chime stands in if it can't play.
 */
export function playIqamah(onEnd?: () => void): void {
  stopAzan();
  playCount += 1;
  const thisPlay = playCount;
  const audio = getAzanElement();
  const isCurrent = () => playCount === thisPlay && activeAudio === audio;
  const finish = () => {
    if (!isCurrent()) return;
    activeAudio = null;
    if (onEnd) onEnd();
  };
  try {
    audio.muted = false;
    audio.src = IQAMAH_SOURCE.url;
    audio.volume = Math.max(0.1, Math.min(1.0, getAzanSettings().volume));
    audio.onplay = null;
    audio.onended = finish;
    audio.onerror = finish;
    activeAudio = audio;
    audio.play()?.catch((err) => {
      if (err?.name !== 'AbortError') finish();
    });
  } catch {
    finish();
  }
}

export function stopAzan(): void {
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {}
    activeAudio = null;
  }
  stopChime();
}

function stopChime(): void {
  chimeOscillators.forEach((osc) => {
    try {
      osc.stop();
    } catch {}
  });
  chimeOscillators = [];
  if (chimeEndTimer) {
    clearTimeout(chimeEndTimer);
    chimeEndTimer = null;
  }
}

export function isAzanPlaying(): boolean {
  return (activeAudio !== null && !activeAudio.paused) || chimeEndTimer !== null;
}

/**
 * Unlocks audio playback. Call from a user gesture (tap / remote OK press) so a
 * later automatic Azan isn't blocked by the browser's autoplay policy.
 */
export function unlockAudio(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      if (!audioContextInstance) audioContextInstance = new AudioContextClass();
      if (audioContextInstance.state === 'suspended') audioContextInstance.resume();
      const silent = audioContextInstance.createBuffer(1, 1, 22050);
      const source = audioContextInstance.createBufferSource();
      source.buffer = silent;
      source.connect(audioContextInstance.destination);
      source.start(0);
    }
  } catch {}

  // Prime the shared Azan player with a silent clip (skipped while an Azan is playing)
  try {
    const audio = getAzanElement();
    if (activeAudio === audio) return;
    audio.muted = true;
    audio.src = SILENT_WAV;
    audio.play()?.then(() => audio.pause()).catch(() => {});
  } catch {}
}

let unlockListening = false;

/** Unlocks audio on the first tap, click or key press anywhere on the page. */
export function unlockAudioOnFirstInteraction(): void {
  if (unlockListening) return;
  unlockListening = true;
  const events = ['pointerdown', 'touchend', 'keydown'];
  const handler = () => {
    unlockAudio();
    events.forEach((e) => window.removeEventListener(e, handler, true));
  };
  events.forEach((e) => window.addEventListener(e, handler, true));
}

/**
 * Acoustic multi-harmonic chime fallback using Web Audio API
 */
export function playAcousticAdhanChime(onEnd?: () => void): void {
  stopChime();
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioContextInstance) audioContextInstance = new AudioContextClass();
    if (audioContextInstance.state === 'suspended') audioContextInstance.resume();

    const now = audioContextInstance.currentTime;
    const notes = [
      { freq: 293.66, time: 0.0, dur: 1.2 }, // D4 (Allahu)
      { freq: 392.00, time: 1.0, dur: 1.5 }, // G4 (Akbar)
      { freq: 349.23, time: 2.2, dur: 1.2 }, // F4 (Allahu)
      { freq: 440.00, time: 3.2, dur: 2.0 }, // A4 (Akbar)
      { freq: 392.00, time: 5.0, dur: 2.5 }  // G4 (La ilaha illallah)
    ];

    notes.forEach((n) => {
      if (!audioContextInstance) return;
      const osc = audioContextInstance.createOscillator();
      const gain = audioContextInstance.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.time);

      gain.gain.setValueAtTime(0, now + n.time);
      gain.gain.linearRampToValueAtTime(0.35, now + n.time + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur);

      osc.connect(gain);
      gain.connect(audioContextInstance.destination);

      osc.start(now + n.time);
      osc.stop(now + n.time + n.dur);
      chimeOscillators.push(osc);
    });

    chimeEndTimer = setTimeout(() => {
      chimeEndTimer = null;
      chimeOscillators = [];
      if (onEnd) onEnd();
    }, 7500);
  } catch (e) {
    if (onEnd) onEnd();
  }
}
