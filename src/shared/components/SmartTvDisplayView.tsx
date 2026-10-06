import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Hadith } from '../types/hadith';
import dailyPoolData from '../data/daily_pool.json';
import { getHijriDate } from '../utils/hijri';
import { loadArabicText, loadDailyHadithOrBundled, loadRandomHadith, loadRandomTopicHadith, loadTopics, HadithTopic, describeHadith } from '../utils/hadithLibrary';
import { GradeBadge } from './GradeBadge';
import { HijriAdjust } from './HijriAdjust';
import { PrayerPhaseOverlay, getPrayerPhase, quranMayContinue, shouldPlayIqamah } from './PrayerPhaseOverlay';
import { QuranDialog, QuranNowPlaying, useQuranPlayer } from './QuranPlayer';
import { getHadithLanguage, useDisplayedHadith, useHadithLanguage, useUiLanguage, setUiLanguage, HadithLanguage } from '../hooks/useHadithLanguage';
import { useI18n } from '../i18n';
import {
  Mosque,
  PrayerTimesResult,
  calculateMosquePrayerTimes,
  getSelectedMosque,
  getAllMosques,
  saveSelectedMosque
} from '../utils/prayerTimes';
import {
  getAzanSettings,
  saveAzanSettings,
  AzanSettings,
  MUEZZIN_SOURCES,
  MuezzinId,
  AZAN_PRAYERS,
  AzanPrayer,
  getMuezzinForPrayer,
  withPrayerMuezzin,
  playAzan,
  stopAzan,
  getAzanPlayCount,
  isAzanPlaying,
  IQAMAH_SOURCE,
  playIqamah,
  DUA_SOURCES,
  DUA_IDS,
  DuaId,
  getDuaForSettings,
  isDuaAfterAzanOn,
  playDua,
  claimIqamahTrigger
} from '../utils/azanAudio';
import { speakHadith, stopSpeaking, isSpeaking } from '../utils/speech';
import {
  SlideSeconds,
  getSlideSeconds,
  saveSlideSeconds,
  nextSlideSeconds,
  BrightnessLevel,
  getTvBrightness,
  saveTvBrightness,
  nextTvBrightness,
  getTvTopic,
  saveTvTopic
} from '../utils/tvSettings';
import { IslamicPattern, IslamicCornerOrnament } from './IslamicPattern';
import { RamadanAccent } from './RamadanAccent';
import { useReloadOnUpdate } from '../hooks/useReloadOnUpdate';
import { IN_ANDROID_APP } from '../utils/androidApp';
import { handleBack } from '../hooks/useBackHandler';
import { THEMES, nextTheme, useAppTheme } from '../theme';
import { AppLogo } from './AppLogo';
import {
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Clock,
  Calendar,
  Compass,
  Building2,
  ChevronLeft,
  ChevronRight,
  BookOpenText,
  Utensils,
  Tv,
  Sun,
  Moon,
  Eye,
  BookOpen,
  MapPin,
  X,
  Music,
  Play,
  Pause,
  Square,
  Timer,
  SunDim,
  Languages,
  Palette,
  ChevronDown,
  Check
} from 'lucide-react';

const MUEZZIN_IDS = Object.keys(MUEZZIN_SOURCES) as MuezzinId[];

interface SmartTvDisplayViewProps {
  onClose?: () => void;
}

// Offline fallback when the sunnah.com library can't be downloaded
const pool = dailyPoolData as Hadith[];

/** Midday of the mosque's calendar day, for dates shown in the mosque's time zone, not the TV's */
function mosqueDay(prayerData: PrayerTimesResult): Date {
  return new Date(`${prayerData.localDateKey}T12:00:00`);
}

const CROSS_REFERENCE = /^[\s(\["]*(as above|see (the )?(previous|above|next) hadith|see hadith)/i;

/**
 * With Arabic Hadiths, downloads the Arabic before the slide changes, so the new
 * Hadith appears straight in Arabic instead of English first. False if it has none.
 */
async function prepareHadith(h: Hadith): Promise<boolean> {
  if (getHadithLanguage() !== 'ar') return true;
  return !!(await loadArabicText(h).catch(() => null));
}

/** A random Hadith from the whole sunnah.com library (skipping "As above" stubs, and ones without Arabic when Arabic is chosen). */
async function pickRandomHadith(topic: string | null): Promise<Hadith> {
  let fallback: Hadith | null = null;
  try {
    for (let i = 0; i < 6; i++) {
      const h = topic ? await loadRandomTopicHadith(topic) : await loadRandomHadith();
      if (h.text.length < 80 && CROSS_REFERENCE.test(h.text)) continue;
      if (await prepareHadith(h)) return h;
      fallback ??= h;
    }
  } catch {}
  if (fallback) return fallback;
  return pool[Math.floor(Math.random() * pool.length)];
}

export const SmartTvDisplayView: React.FC<SmartTvDisplayViewProps> = ({ onClose }) => {
  const i18n = useI18n();
  const { t } = i18n;
  const [selectedMosque, setSelectedMosque] = useState<Mosque>(getSelectedMosque());
  const [prayerData, setPrayerData] = useState<PrayerTimesResult>(
    calculateMosquePrayerTimes(selectedMosque, new Date())
  );
  const [azanSettings, setAzanSettings] = useState<AzanSettings>(getAzanSettings());
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentPeriod, setCurrentPeriod] = useState<'AM' | 'PM'>('AM');
  const [currentSecondsStr, setCurrentSecondsStr] = useState('');
  const [clockDate, setClockDate] = useState(() => new Date());
  const [dismissedPhase, setDismissedPhase] = useState<string | null>(null);
  const [currentHijriStr, setCurrentHijriStr] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Starts on the Hadith of the Day, then shows random Hadiths from all of sunnah.com
  const [activeHadith, setActiveHadith] = useState<Hadith | null>(null);
  const [isDailyHadith, setIsDailyHadith] = useState(true);
  const [showExcerpt, setShowExcerpt] = useState(false);
  const shownHadithsRef = useRef<{ hadith: Hadith; isDaily: boolean }[]>([]);
  const [slideSeconds, setSlideSeconds] = useState<SlideSeconds>(getSlideSeconds);
  const [brightness, setBrightness] = useState<BrightnessLevel>(getTvBrightness);
  // 'Auto': dim from an hour after Isha until 30 minutes before Fajr
  const effectiveBrightness = (() => {
    if (brightness !== 'auto') return brightness;
    const [h, m] = prayerData.localTime24.split(':').map(Number);
    const now = h * 60 + m;
    const night = now >= prayerData.adhanMinutes.Isha + 60 || now < prayerData.adhanMinutes.Fajr - 30;
    return night ? 25 : 100;
  })();
  // Shared app theme; time-based ones follow the selected mosque's prayer times
  const appTheme = useAppTheme();
  const themeLabel = t(THEMES.find((x) => x.id === appTheme.theme)!.label);
  const [driftOffset, setDriftOffset] = useState({ x: 0, y: 0 });
  const [openDialog, setOpenDialog] = useState<'mosque' | 'azan' | 'topic' | 'language' | 'quran' | null>(null);
  // Screen and Hadith languages, chosen separately on the TV
  const uiLanguage = useUiLanguage();
  const [hadithLanguage, setHadithLanguage] = useHadithLanguage();
  const languageFirstButtonRef = useRef<HTMLButtonElement>(null);
  // Slides from one topic (or the whole library)
  const [topic, setTopic] = useState<string | null>(getTvTopic);
  const topicRef = useRef(topic);
  topicRef.current = topic;
  const [topics, setTopics] = useState<HadithTopic[]>([]);
  useEffect(() => {
    loadTopics().then(setTopics).catch(() => {});
  }, []);
  const topicButtonRef = useRef<HTMLButtonElement>(null);
  const isMosquePickerOpen = openDialog === 'mosque';
  // Quran recitation: replaces the Hadith slides while it plays
  const quran = useQuranPlayer();
  const quranRef = useRef(quran);
  quranRef.current = quran;
  // Iqamah countdown / prayer in progress at this moment (Friday Dhuhr is Jumu'ah)
  const prayerPhase = (() => {
    const [h, m] = prayerData.localTime24.split(':').map(Number);
    const isFriday = mosqueDay(prayerData).getDay() === 5;
    return getPrayerPhase(prayerData, h * 60 + m + clockDate.getSeconds() / 60, (p) => isFriday && p === 'Dhuhr');
  })();
  // The Quran pauses once for each Adhan and prayer; pressing Play again carries on
  const quranPausedForRef = useRef<string | null>(null);
  // The prayer ("date-prayer") the paused Quran waits for, to carry on once it's over
  const quranWaitingForRef = useRef<string | null>(null);
  const prayerPhaseKey = prayerPhase ? `${prayerData.localDateKey}-${prayerPhase.prayer}` : null;
  useEffect(() => {
    if (!quran.playing) return;
    const reason = prayerPhaseKey ?? (isAzanPlaying() ? `azan-${getAzanPlayCount()}` : null);
    if (reason && reason !== quranPausedForRef.current) {
      quranPausedForRef.current = reason;
      quranWaitingForRef.current = prayerPhaseKey;
      quran.pauseForPrayer();
    }
  }, [clockDate, quran.playing]);
  // After the Iqamah and the prayer: the Quran carries on from where it stopped
  useEffect(() => {
    if (!quran.pausedForPrayer || !quranMayContinue(quranWaitingForRef.current, prayerPhaseKey, isAzanPlaying())) return;
    quranWaitingForRef.current = null;
    quran.continueAfterPrayer();
  }, [clockDate, quran.pausedForPrayer]);
  // In the Android app, a newer deployed version loads by itself at a quiet moment
  useReloadOnUpdate(IN_ANDROID_APP, !prayerPhase && !isAzanPlaying() && !quran.active && !openDialog);
  // When the Iqamah countdown ends, the Iqamah plays once (only live: not when the TV is
  // switched on later in the prayer; off with Auto-Azan muted or the Iqamah turned off)
  useEffect(() => {
    const [h, m] = prayerData.localTime24.split(':').map(Number);
    if (!prayerPhase || !shouldPlayIqamah(prayerPhase, prayerData, h * 60 + m + clockDate.getSeconds() / 60, azanSettings)) return;
    if (!claimIqamahTrigger(`${prayerData.localDateKey}_${prayerPhase.prayer}`)) return;
    if (quranRef.current.playing) quranWaitingForRef.current = prayerPhaseKey;
    quranRef.current.pauseForPrayer();
    playIqamah();
  }, [clockDate]);
  const [previewingRow, setPreviewingRow] = useState<string | null>(null);
  // playAzan() count of the running preview; a newer count means the real Azan took over
  const previewPlayRef = useRef(0);
  const azanDialogFirstButtonRef = useRef<HTMLButtonElement>(null);
  // The Du'a recitation dropdown in the Azan dialog
  const [duaMenuOpen, setDuaMenuOpen] = useState(false);
  const duaButtonRef = useRef<HTMLButtonElement>(null);
  const duaChosenOptionRef = useRef<HTMLButtonElement>(null);
  const duaMenuRef = useRef<HTMLDivElement>(null);
  const duaMenuOpenRef = useRef(false);
  duaMenuOpenRef.current = duaMenuOpen;
  // Set while history.back() is on its way to close the list, so it is only sent once
  const duaMenuClosingRef = useRef(false);
  const selectedMosqueButtonRef = useRef<HTMLButtonElement>(null);
  const hadithBoxRef = useRef<HTMLDivElement>(null);
  const hadithContentRef = useRef<HTMLDivElement>(null);
  const hadithTextRef = useRef<HTMLQuoteElement>(null);
  const hadithNarratorRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Wake lock ref to keep TV display awake
  const wakeLockRef = useRef<any>(null);

  // Request Wake Lock so TV screen never dims or turns off
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
      }
    };
    requestWakeLock();

    // The browser drops the wake lock whenever the page is hidden; take it again on return
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  // Clock, Prayer Timer & OLED Anti-Burn-in drift engine
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const currentCalc = calculateMosquePrayerTimes(selectedMosque, now);
      setPrayerData(currentCalc);

      // The mosque's time, like the prayer times, even when the TV is set to another time zone
      const [h, m] = currentCalc.localTime24.split(':').map(Number);
      const hours = String(h % 12 || 12).padStart(2, '0');
      const minutes = String(m).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';

      setCurrentTimeStr(`${hours}:${minutes}`);
      setCurrentPeriod(ampm);
      setCurrentSecondsStr(seconds);

      setClockDate(now);

      setCurrentHijriStr(getHijriDate(mosqueDay(currentCalc)).formatted);
    };

    updateTime();
    const clockInterval = setInterval(updateTime, 1000);
    return () => clearInterval(clockInterval);
  }, [selectedMosque]);

  // OLED Burn-in micro-drift (shifts content 1-3 pixels every 90 seconds)
  useEffect(() => {
    const driftInterval = setInterval(() => {
      const randomX = (Math.random() - 0.5) * 6;
      const randomY = (Math.random() - 0.5) * 6;
      setDriftOffset({ x: randomX, y: randomY });
    }, 90000);

    return () => clearInterval(driftInterval);
  }, []);

  useEffect(() => {
    loadDailyHadithOrBundled(new Date()).then(async (daily) => {
      await prepareHadith(daily.hadith);
      setActiveHadith((current) => current ?? daily.hadith);
    });
  }, []);

  const showHadith = (hadith: Hadith, isDaily: boolean) => {
    setShowExcerpt(false);
    setActiveHadith(hadith);
    setIsDailyHadith(isDaily);
  };

  const activeHadithRef = useRef<{ hadith: Hadith | null; isDaily: boolean }>({ hadith: null, isDaily: true });
  activeHadithRef.current = { hadith: activeHadith, isDaily: isDailyHadith };

  const showNextHadith = async () => {
    const next = await pickRandomHadith(topicRef.current);
    const { hadith, isDaily } = activeHadithRef.current;
    if (hadith) shownHadithsRef.current = [...shownHadithsRef.current.slice(-49), { hadith, isDaily }];
    showHadith(next, false);
  };

  const showPreviousHadith = () => {
    const previous = shownHadithsRef.current.pop();
    if (previous) showHadith(previous.hadith, previous.isDaily);
  };

  const slideLabel = slideSeconds === 0
    ? t('Paused')
    : slideSeconds < 60
      ? t('{n} sec', { n: slideSeconds })
      : t('{n} min', { n: slideSeconds / 60 });

  const cycleSlideSpeed = () => {
    setSlideSeconds((current) => {
      const next = nextSlideSeconds(current);
      saveSlideSeconds(next);
      return next;
    });
  };

  const cycleTheme = () => appTheme.setTheme(nextTheme(appTheme.theme));

  const cycleBrightness = () => {
    setBrightness((current) => {
      const next = nextTvBrightness(current);
      saveTvBrightness(next);
      return next;
    });
  };

  // Next Hadith after the chosen time; restarts whenever the Hadith changes, so one
  // picked with Ch +/− also stays up for the full time
  useEffect(() => {
    if (!slideSeconds || !activeHadith || quran.active) return;
    const hadithTimer = setTimeout(showNextHadith, slideSeconds * 1000);
    return () => clearTimeout(hadithTimer);
  }, [slideSeconds, activeHadith, quran.active]);

  // Keyboard navigation for TV Remotes (D-Pad / Keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Typing in a text box: letters are text, not shortcuts
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && e.key !== 'Escape') return;
      const player = quranRef.current;
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'q' || e.key === 'Q') {
        openDialogOf('quran');
      } else if (e.key === 'MediaPlayPause' || e.key === 'MediaPlay' || e.key === 'MediaPause') {
        if (player.active) player.toggle();
      } else if (player.active && !openDialog && (e.key === 'MediaTrackNext' || e.key === 'ChannelUp' || e.key === 'MediaFastForward')) {
        player.next();
      } else if (player.active && !openDialog && (e.key === 'MediaTrackPrevious' || e.key === 'ChannelDown' || e.key === 'MediaRewind')) {
        player.previous();
      } else if (e.key === 'MediaTrackNext' || e.key === 'ChannelUp' || e.key === 'MediaFastForward') {
        showNextHadith();
      } else if (e.key === 'MediaTrackPrevious' || e.key === 'ChannelDown' || e.key === 'MediaRewind') {
        showPreviousHadith();
      } else if (e.key === 'm' || e.key === 'M') {
        const next = !azanSettings.autoAzanEnabled;
        const updated = { ...azanSettings, autoAzanEnabled: next };
        setAzanSettings(updated);
        saveAzanSettings(updated);
      } else if (e.key === 'l' || e.key === 'L') {
        openDialogOf('language');
      } else if (e.key === 's' || e.key === 'S') {
        cycleSlideSpeed();
      } else if (e.key === 'b' || e.key === 'B') {
        cycleBrightness();
      } else if (e.key === 't' || e.key === 'T') {
        cycleTheme();
      } else if (e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack') {
        // The Azan popup (over everything) first
        if (handleBack()) {
          e.preventDefault();
        } else if (openDialog) {
          e.preventDefault();
          closeDialog();
        } else if (player.active) {
          e.preventDefault();
          player.stop();
        } else if (onClose) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [azanSettings, appTheme.theme, onClose, openDialog]);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(!!document.fullscreenElement);
    syncFullscreen();
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  // Whole document (not just this view) so the Azan modal stays visible in fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Put the remote's focus inside a dialog when it opens
  useEffect(() => {
    if (openDialog === 'mosque') selectedMosqueButtonRef.current?.focus();
    if (openDialog === 'azan') azanDialogFirstButtonRef.current?.focus();
    if (openDialog === 'topic') topicButtonRef.current?.focus();
    if (openDialog === 'language') languageFirstButtonRef.current?.focus();
  }, [openDialog]);

  // The remote's Back button (and Esc in fullscreen) never reaches the page as a key;
  // it navigates history. A history entry per open dialog lets Back close it, and one
  // under it while the Quran plays lets Back stop the recitation:
  // start page -> { tvQuran } -> { tvDialog }
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // The Du'a list has its own entry over the Azan dialog's: Back closes just the list
      if (duaMenuOpenRef.current && e.state?.tvDialog) {
        const active = document.activeElement;
        const focusInList = !active || active === document.body || !!duaMenuRef.current?.contains(active);
        duaMenuClosingRef.current = false;
        setDuaMenuOpen(false);
        if (focusInList) duaButtonRef.current?.focus();
        return;
      }
      setOpenDialog(null);
      if (!e.state?.tvQuran) quranRef.current.stop();
      else if (!quranRef.current.active) window.history.back();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // The recitation stopped (Stop, or the end of the surah): drop its history entry
  useEffect(() => {
    if (!quran.active && window.history.state?.tvQuran) window.history.back();
  }, [quran.active]);

  // A surah was picked: the dialog's history entry becomes the recitation's
  // (one already exists if the Quran was playing)
  const closeQuranDialogAndPlay = () => {
    if (!quran.active && window.history.state?.tvDialog) {
      window.history.replaceState({ tvQuran: true }, '');
      setOpenDialog(null);
    } else {
      closeDialog();
    }
  };

  const stopQuranFromDialog = () => {
    const wasActive = quran.active;
    quran.stop();
    setOpenDialog(null);
    if (window.history.state?.tvDialog) window.history.go(wasActive ? -2 : -1);
  };

  // The Du'a list opens on the chosen recitation and closes with the Azan dialog
  useEffect(() => {
    if (duaMenuOpen) duaChosenOptionRef.current?.focus();
  }, [duaMenuOpen]);
  useEffect(() => {
    if (openDialog !== 'azan') setDuaMenuOpen(false);
  }, [openDialog]);

  // Stop any voice preview when the Azan dialog closes
  useEffect(() => {
    if (openDialog !== 'azan' && previewingRow) {
      stopPreview();
    }
  }, [openDialog, previewingRow]);

  // Stops only the preview, never a prayer's Azan that started since
  const stopPreview = () => {
    if (getAzanPlayCount() === previewPlayRef.current) stopAzan();
    setPreviewingRow(null);
  };

  const openDialogOf = (kind: 'mosque' | 'azan' | 'topic' | 'language' | 'quran') => {
    window.history.pushState({ tvDialog: true }, '');
    setOpenDialog(kind);
  };

  const closeDialog = () => {
    if (window.history.state?.tvDialog) {
      window.history.back();
    } else {
      setOpenDialog(null);
    }
  };

  const handleSelectMosque = (m: Mosque) => {
    setSelectedMosque(m);
    saveSelectedMosque(m.id);
    setPrayerData(calculateMosquePrayerTimes(m, new Date()));
    closeDialog();
  };

  const updateAzanSettings = (updated: AzanSettings) => {
    setAzanSettings(updated);
    saveAzanSettings(updated);
  };

  // OK on "Change" steps through the voices; a prayer's list also includes "Default"
  const cycleDefaultMuezzin = () => {
    const next = MUEZZIN_IDS[(MUEZZIN_IDS.indexOf(azanSettings.selectedMuezzin) + 1) % MUEZZIN_IDS.length];
    updateAzanSettings({ ...azanSettings, selectedMuezzin: next });
  };

  const cyclePrayerMuezzin = (prayer: AzanPrayer) => {
    const choices: (MuezzinId | null)[] = [null, ...MUEZZIN_IDS];
    const current = azanSettings.prayerMuezzins?.[prayer] ?? null;
    const next = choices[(choices.indexOf(current) + 1) % choices.length];
    updateAzanSettings(withPrayerMuezzin(azanSettings, prayer, next));
  };

  const openDuaMenu = () => {
    window.history.pushState({ tvDialog: true, tvDuaMenu: true }, '');
    duaMenuClosingRef.current = false;
    setDuaMenuOpen(true);
  };
  // Through history, like the remote's Back, so the list's entry goes with it
  const closeDuaMenu = () => {
    if (duaMenuClosingRef.current) return;
    if (window.history.state?.tvDuaMenu) {
      duaMenuClosingRef.current = true;
      window.history.back();
    } else {
      setDuaMenuOpen(false);
      duaButtonRef.current?.focus();
    }
  };
  const chooseDua = (dua: DuaId) => {
    if (previewingRow === 'dua') stopPreview();
    updateAzanSettings({ ...azanSettings, selectedDua: dua });
    closeDuaMenu();
  };

  const togglePreview = (row: string, muezzin: MuezzinId | 'iqamah' | 'dua') => {
    if (previewingRow === row) {
      stopPreview();
      return;
    }
    setPreviewingRow(row);
    const done = () => setPreviewingRow((current) => (current === row ? null : current));
    if (muezzin === 'iqamah') playIqamah(done);
    else if (muezzin === 'dua') playDua(done, getDuaForSettings(azanSettings));
    else playAzan(undefined, done, muezzin);
    previewPlayRef.current = getAzanPlayCount();
  };
  const iqamahOn = azanSettings.iqamahSound !== false;
  const duaOn = isDuaAfterAzanOn(azanSettings);
  // The Iqamah for one prayer (all on unless turned off one by one)
  const iqamahFor = (prayer: AzanPrayer) => azanSettings.iqamahPrayers?.[prayer] !== false;
  const toggleIqamahFor = (prayer: AzanPrayer) => {
    const iqamahPrayers = { ...azanSettings.iqamahPrayers };
    if (iqamahFor(prayer)) iqamahPrayers[prayer] = false;
    else delete iqamahPrayers[prayer];
    updateAzanSettings({ ...azanSettings, iqamahPrayers });
  };


  const mosquesByState = getAllMosques()
    .slice()
    .sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));


  // The Hadith in the chosen language; a language switch starts again from the full text
  const { hadith: shownHadith } = useDisplayedHadith(activeHadith);
  const fittedTextRef = useRef<string | undefined>(undefined);

  // Largest font (52px down to 24px) at which the whole Hadith fits its panel,
  // whatever the screen's shape — re-fitted when the Hadith or the screen changes.
  useLayoutEffect(() => {
    if (fittedTextRef.current !== shownHadith?.text) {
      fittedTextRef.current = shownHadith?.text;
      if (showExcerpt) {
        setShowExcerpt(false);
        return;
      }
    }
    const fit = () => {
      const box = hadithBoxRef.current;
      const content = hadithContentRef.current;
      const text = hadithTextRef.current;
      if (!box || !content || !text) return;
      // The narrator line (some are several sentences long) shrinks with the text
      const narrator = hadithNarratorRef.current;
      const setSize = (px: number) => {
        text.style.fontSize = `${px}px`;
        if (narrator) narrator.style.fontSize = `${Math.round(px * 0.65)}px`;
      };
      let size = 52;
      setSize(size);
      while (size > 24 && content.offsetHeight > box.clientHeight) {
        size -= 2;
        setSize(size);
      }
      // Some Hadiths are pages long; show the excerpt when even the smallest size won't fit
      if (content.offsetHeight > box.clientHeight && shownHadith?.isLong && !showExcerpt) setShowExcerpt(true);
    };
    fit();
    // Web fonts arrive after the first paint and change the text's height
    document.fonts?.ready.then(fit).catch(() => {});
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [shownHadith?.text, shownHadith?.narrator, showExcerpt]);


  const prayerCards = [
    { name: 'Fajr', arabic: 'الفجر', time: prayerData.fajr, icon: '🌅', iqama: prayerData.iqama.Fajr },
    { name: 'Sunrise', arabic: 'الشروق', time: prayerData.sunrise, icon: '☀️', iqama: undefined },
    { name: 'Dhuhr', arabic: 'الظهر', time: prayerData.dhuhr, icon: '☀️', iqama: prayerData.iqama.Dhuhr },
    { name: 'Asr', arabic: 'العصر', time: prayerData.asr, icon: '🌤️', iqama: prayerData.iqama.Asr },
    { name: 'Maghrib', arabic: 'المغرب', time: prayerData.maghrib, icon: '🌇', iqama: prayerData.iqama.Maghrib },
    { name: 'Isha', arabic: 'العشاء', time: prayerData.isha, icon: '🌙', iqama: prayerData.iqama.Isha }
  ];

  // Designed for a fixed 1920x1080 canvas (scaled to the screen by the TV app),
  // so sizes are absolute and readable from across the room — no breakpoints.
  const compassPoints = i18n.isArabic
    ? ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب']
    : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const qiblaDirection = compassPoints[Math.round(prayerData.qiblaBearing / 45) % 8];

  return (
    <div
      ref={containerRef}
      style={{ transform: `translate3d(${driftOffset.x}px, ${driftOffset.y}px, 0)` }}
      className={`fixed inset-0 z-50 w-full h-full app-bg text-white flex flex-col px-[72px] py-[44px] select-none overflow-hidden transition-colors duration-700`}
    >
      <IslamicPattern opacity={12} />
      <IslamicCornerOrnament className="absolute top-4 left-4 rotate-0 opacity-40 scale-125" />
      <IslamicCornerOrnament className="absolute top-4 right-4 rotate-90 opacity-40 scale-125" />
      <IslamicCornerOrnament className="absolute bottom-4 left-4 -rotate-90 opacity-40 scale-125" />
      <IslamicCornerOrnament className="absolute bottom-4 right-4 rotate-180 opacity-40 scale-125" />

      {/* 1. HEADER: brand & mosque | dates | clock */}
      <header className="relative z-20 shrink-0 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-12 pb-6 border-b border-white/15">
        <div className="flex items-center gap-5 min-w-0">
          <AppLogo size={76} glow={true} />
          {prayerData.isRamadan && <RamadanAccent size="tv" className="-ms-2" />}
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="font-serif text-[40px] leading-tight font-extrabold tracking-tight text-white whitespace-nowrap">
                {t('Daily Hadith & Azan')}
              </span>
            </div>
            <div className="text-[22px] text-neutral-300 flex items-start gap-2 mt-1 min-w-0">
              <Building2 className="w-6 h-6 mt-0.5 shrink-0 text-amber-400" />
              <span className="line-clamp-2">
                <span className="font-semibold text-amber-200">{selectedMosque.name}</span>
                <span className="text-neutral-500"> • </span>
                <span className="whitespace-nowrap">{selectedMosque.suburb}, {selectedMosque.state}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="font-arabic text-[34px] leading-tight text-amber-300 font-semibold whitespace-nowrap">
            {i18n.hijri(currentHijriStr)}
          </div>
          <div className="text-[22px] text-neutral-300 font-medium whitespace-nowrap">
            {i18n.date(mosqueDay(prayerData), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        <div className="flex items-center justify-end">
          {/* Digits always left to right; ص/م sits before them in Arabic, AM/PM after them in English */}
          <div dir="ltr" className="font-mono text-[76px] leading-none font-extrabold tracking-tight text-white flex items-baseline gap-3 whitespace-nowrap">
            {i18n.isArabic && <span className="text-[40px] text-neutral-300 font-bold">{i18n.time(currentPeriod).trim()}</span>}
            <span>
              {currentTimeStr}
              <span className="text-[28px] text-amber-400 font-bold">:{currentSecondsStr}</span>
            </span>
            {!i18n.isArabic && <span className="text-[40px] text-neutral-300 font-bold">{currentPeriod}</span>}
          </div>
        </div>
      </header>

      {/* 2. BODY: Hadith (7/12) | Next prayer & timetable (5/12) */}
      <main className="relative z-20 flex-1 min-h-0 grid grid-cols-12 gap-8 my-7">
        {/* Featured Hadith */}
        <div className="col-span-7 min-h-0 flex flex-col rounded-[32px] bg-[var(--tv-panel)] border border-amber-500/30 px-12 py-10 shadow-2xl relative overflow-hidden backdrop-blur-md">
          <IslamicPattern opacity={16} />

          {quran.active && (
            <QuranNowPlaying player={quran} i18n={i18n} showTranslation={hadithLanguage === 'en'} onChoose={() => openDialogOf('quran')} />
          )}

          <div className={`relative z-10 shrink-0 flex items-center justify-between gap-6 ${quran.active ? 'invisible' : ''}`}>
            <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[20px] font-bold uppercase tracking-wider whitespace-nowrap">
              <BookOpenText className="w-6 h-6" />
              <span>{activeHadith ? i18n.collection(activeHadith.collection) : 'sunnah.com'}</span>
            </div>

            <div className="flex items-center gap-3 text-[20px] text-neutral-400">
              {isDailyHadith && <span className="whitespace-nowrap">{t('Hadith of the Day')}</span>}
              <button
                onClick={() => openDialogOf('topic')}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[20px] whitespace-nowrap cursor-pointer"
                title={t('Hadith topic for the slides')}
              >
                {(() => {
                  const current = topics.find((x) => x.id === topic);
                  return current ? (i18n.isArabic ? current.nameAr : current.name) : t('All topics');
                })()}
              </button>
              <button
                onClick={showPreviousHadith}
                title={t('Previous Hadith')}
                className="p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6 rtl:rotate-180" />
              </button>
              <button
                onClick={showNextHadith}
                title={t('Next Hadith')}
                className="p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <ChevronRight className="w-6 h-6 rtl:rotate-180" />
              </button>
            </div>
          </div>

          <div ref={hadithBoxRef} className={`relative z-10 flex-1 min-h-0 flex flex-col justify-center overflow-hidden my-6 ${quran.active ? 'invisible' : ''}`}>
            {/* Its own direction: an English Hadith on an Arabic screen still reads left to right */}
            <div ref={hadithContentRef} dir={shownHadith ? (shownHadith.isArabic ? 'rtl' : 'ltr') : undefined} lang={shownHadith ? (shownHadith.isArabic ? 'ar' : 'en') : undefined}>
              {shownHadith?.narrator && (
                <div ref={hadithNarratorRef} className="font-serif text-[34px] font-bold text-amber-300 mb-5">
                  {shownHadith.narrator}
                </div>
              )}
              <blockquote
                ref={hadithTextRef}
                data-hadith-text
                dir={shownHadith?.isArabic ? 'rtl' : undefined}
                className={`${shownHadith?.isArabic ? 'font-arabic' : 'font-serif'} text-[52px] leading-[1.45] text-neutral-100`}
              >
                {!shownHadith
                  ? t('Loading the Hadith of the Day…')
                  : shownHadith.isArabic
                    ? (showExcerpt ? shownHadith.excerpt : shownHadith.text)
                    : /^\s*["“‘']/.test(shownHadith.text)
                      ? (showExcerpt ? shownHadith.excerpt : shownHadith.text)
                      : <>&ldquo;{showExcerpt ? shownHadith.excerpt : shownHadith.text}&rdquo;</>}
              </blockquote>
            </div>
          </div>

          <div className={`relative z-10 shrink-0 pt-6 border-t border-white/10 flex items-center justify-between gap-6 ${quran.active ? 'invisible' : ''}`}>
            <div className="text-[22px] text-neutral-300 font-mono flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
              {activeHadith && (
                <>
                  <GradeBadge hadith={activeHadith} size="tv" showGrader />
                  <span className="text-amber-400 font-semibold">{describeHadith(activeHadith, i18n.language).reference}</span>
                  <span className="text-neutral-500">•</span>
                  <span>{describeHadith(activeHadith, i18n.language).detail}</span>
                  {showExcerpt && <span className="text-neutral-500">({t('excerpt')})</span>}
                </>
              )}
            </div>

            {prayerData.isRamadan && (
            <div className="shrink-0 flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 text-[22px] whitespace-nowrap">
              <Utensils className="w-6 h-6 text-emerald-400" />
              {prayerData.ramadanDay && <span className="text-emerald-300 font-bold">{t('Ramadan {n}', { n: prayerData.ramadanDay })} •</span>}
              <span className="text-neutral-300">
                {prayerData.nextFastingEvent.type === 'Iftar'
                  ? t('Iftar {time}', { time: i18n.time(prayerData.maghrib) })
                  : t('Suhoor ends {time}', { time: i18n.time(prayerData.nextFastingEvent.time) })}
              </span>
              <span className="text-emerald-400 font-bold font-mono">
                ({i18n.duration(prayerData.nextFastingEvent.remainingFormatted)})
              </span>
            </div>
            )}
          </div>
        </div>

        {/* Next prayer & timetable */}
        <div className="col-span-5 min-h-0 flex flex-col gap-5">
          <div className="shrink-0 px-9 py-7 rounded-[32px] bg-gradient-to-r from-amber-600/30 via-[var(--tv-hero-mid)] to-[var(--tv-hero-end)] border border-amber-500/40 shadow-2xl relative overflow-hidden flex items-center justify-between gap-6">
            <IslamicPattern opacity={14} />
            <div className="relative z-10 min-w-0">
              <div className="text-[20px] uppercase tracking-widest text-amber-300 font-bold">
                {t('Next Prayer')}
              </div>
              <h3 className="font-serif text-[64px] leading-tight font-extrabold text-white">
                {i18n.prayer(prayerData.isFriday && prayerData.nextPrayer.name === 'Dhuhr' ? "Jumu'ah" : prayerData.nextPrayer.name)}
              </h3>
              <div className="text-[22px] font-mono text-neutral-300 flex flex-wrap gap-x-4">
                <span className="whitespace-nowrap">{t('Adhan')} <span className="text-amber-300 font-bold">{i18n.time(prayerData.nextPrayer.time)}</span></span>
                {prayerData.isFriday && prayerData.nextPrayer.name === 'Dhuhr' ? (
                  <span className="whitespace-nowrap text-emerald-400">{t("Jumu'ah")} {i18n.time(prayerData.jumuah)}</span>
                ) : prayerData.nextPrayer.iqamaTime && (
                  <span className="whitespace-nowrap text-emerald-400">{t('Iqamah')} {i18n.time(prayerData.nextPrayer.iqamaTime)}</span>
                )}
              </div>
            </div>

            <div className="relative z-10 text-end shrink-0">
              <div className="text-[18px] uppercase tracking-widest text-neutral-400 font-semibold">
                {t('Remaining')}
              </div>
              <div className="text-[60px] leading-tight font-mono font-extrabold text-amber-300 whitespace-nowrap">
                {i18n.duration(prayerData.nextPrayer.remainingFormatted)}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-2 grid-rows-3 gap-4">
            {prayerCards.map((p) => {
              const isNext = prayerData.nextPrayer.name === p.name;
              const isCurrent = prayerData.currentPrayer === p.name;

              return (
                <div
                  key={p.name}
                  data-prayer-card
                  className={`min-h-0 px-6 py-3 rounded-3xl border transition-all flex flex-col justify-center ${
                    isNext
                      ? 'bg-gradient-to-r from-amber-500/25 via-[var(--tv-next-mid)] to-[var(--tv-next-end)] border-amber-400 ring-4 ring-amber-500/40 shadow-xl'
                      : isCurrent
                      ? 'bg-[var(--tv-card)] border-emerald-500/50'
                      : 'bg-[var(--tv-card)] border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[26px] leading-none">{p.icon}</span>
                      <span className="font-bold text-[26px] leading-tight text-white">{i18n.prayer(prayerData.isFriday && p.name === 'Dhuhr' ? "Jumu'ah" : p.name)}</span>
                    </div>
                    {isNext && (
                      <span className="shrink-0 text-[14px] px-3 py-0.5 rounded-full bg-amber-500 text-neutral-950 font-extrabold uppercase tracking-wider">
                        {t('Next')}
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[36px] leading-tight font-bold text-amber-300 whitespace-nowrap">
                    {i18n.time(p.time)}
                  </div>
                  <div className="text-[18px] text-neutral-400 flex items-center gap-2 whitespace-nowrap">
                    <span className={i18n.isArabic ? '' : 'font-arabic'}>{i18n.isArabic ? p.name : p.arabic}</span>
                    <span>•</span>
                    <span>
                      {prayerData.isFriday && p.name === 'Dhuhr' ? (
                        <span className="text-emerald-300">{i18n.time(prayerData.jumuah)}</span>
                      ) : p.iqama ? (
                        <>{t('Iqamah')} <span className="font-mono text-emerald-300">{i18n.time(p.iqama)}</span></>
                      ) : p.name === 'Sunrise' ? (
                        t('Sunrise')
                      ) : prayerData.iqamaCheck[p.name as keyof typeof prayerData.iqamaCheck] ? (
                        t('Iqamah: check with the mosque')
                      ) : (
                        `${t('Iqamah')} —`
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="shrink-0 px-6 py-4 rounded-3xl bg-[var(--tv-strip)] border border-white/10 flex items-center justify-between gap-4 text-[22px] text-neutral-300">
            <div className="flex items-center gap-3 min-w-0">
              <Calendar className="w-6 h-6 shrink-0 text-amber-400" />
              <span>{t("Jumu'ah")} <strong className="text-white">{i18n.time(prayerData.jumuah)}</strong></span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Compass className="w-6 h-6 text-sky-400" />
              <span>{t('Qibla')} <strong className="text-sky-300 font-mono">{prayerData.qiblaBearing}° {qiblaDirection}</strong></span>
            </div>
          </div>
        </div>
      </main>

      {/* 3. FOOTER: status | controls */}
      <footer className="relative z-20 shrink-0 pt-3 border-t border-white/10 flex items-center justify-between gap-6 text-[18px] text-neutral-400">
        <div className="flex items-center gap-4 whitespace-nowrap">
          <span>
            {t('Azan')}: <strong className="text-amber-300">{t(MUEZZIN_SOURCES[azanSettings.selectedMuezzin]?.name)}</strong>
          </span>
        </div>

        <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => openDialogOf('language')}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-neutral-200 hover:text-white text-[20px] font-semibold whitespace-nowrap transition cursor-pointer"
                title={t('Language [L]')}
              >
                <Languages className="w-6 h-6" />
                <span>{uiLanguage === 'ar' ? 'العربية' : 'English'}</span>
                <span className="text-neutral-500">•</span>
                <span className="text-amber-300">{t('Hadith')}: {hadithLanguage === 'ar' ? 'العربية' : 'English'}</span>
              </button>

              <button
                onClick={cycleSlideSpeed}
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl transition cursor-pointer text-[20px] font-semibold whitespace-nowrap ${
                  slideSeconds
                    ? 'bg-white/10 hover:bg-white/20 text-neutral-200 hover:text-white'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
                title={t('Hadith slide speed: how long each Hadith stays on screen [S]')}
                aria-label={t('Hadith slide speed: {value}. Press to change.', { value: slideLabel })}
              >
                {slideSeconds ? <Timer className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
                <span>{slideLabel}</span>
              </button>

              <button
                onClick={cycleBrightness}
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl transition cursor-pointer text-[20px] font-semibold whitespace-nowrap ${
                  brightness === 100 || (brightness === 'auto' && effectiveBrightness === 100)
                    ? 'bg-white/10 hover:bg-white/20 text-neutral-200 hover:text-white'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
                title={t('Screen brightness [B]')}
                aria-label={t('Screen brightness: {value}%. Press to change.', { value: effectiveBrightness })}
              >
                {effectiveBrightness === 100 ? <Sun className="w-6 h-6" /> : <SunDim className="w-6 h-6" />}
                <span>{brightness === 'auto' ? `${t('Auto')} ${effectiveBrightness}%` : `${brightness}%`}</span>
              </button>

              <button
                onClick={() => openDialogOf('quran')}
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl transition cursor-pointer text-[20px] font-semibold whitespace-nowrap ${
                  quran.active
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-white/10 hover:bg-white/20 text-neutral-200 hover:text-white'
                }`}
                title={t('Quran Recitation [Q]')}
              >
                <BookOpen className="w-6 h-6" />
                <span>{quran.active ? <span className="font-arabic">{quran.surah.ar}</span> : t('Quran')}</span>
              </button>

              <button
                onClick={() => openDialogOf('mosque')}
                className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-neutral-200 hover:text-white transition cursor-pointer"
                title={t('Choose Mosque')}
              >
                <MapPin className="w-6 h-6" />
              </button>

              <button
                onClick={() => openDialogOf('azan')}
                className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-neutral-200 hover:text-white transition cursor-pointer"
                title={t('Azan Voices')}
              >
                <Music className="w-6 h-6" />
              </button>

              <button
                onClick={cycleTheme}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-neutral-200 hover:text-white transition cursor-pointer text-[20px] font-semibold whitespace-nowrap"
                title={t('Switch Theme [T]')}
              >
                <Palette className="w-6 h-6" />
                <span>{themeLabel}</span>
              </button>

              <button
                onClick={() => {
                  const next = !azanSettings.autoAzanEnabled;
                  const updated = { ...azanSettings, autoAzanEnabled: next };
                  setAzanSettings(updated);
                  saveAzanSettings(updated);
                }}
                className={`p-3 rounded-2xl transition cursor-pointer ${
                  azanSettings.autoAzanEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-white/10 text-neutral-400'
                }`}
                title={t(azanSettings.autoAzanEnabled ? 'Auto-Azan On [M]' : 'Auto-Azan Muted [M]')}
              >
                {azanSettings.autoAzanEnabled ? <Volume2 className="w-6 h-6 text-emerald-400" /> : <VolumeX className="w-6 h-6" />}
              </button>

              <button
                onClick={toggleFullscreen}
                className="p-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold transition shadow-lg cursor-pointer"
                title={t('Toggle Fullscreen [F]')}
              >
                {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
              </button>

              {onClose && (
                <button
                  onClick={onClose}
                  className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-rose-500/30 text-neutral-200 hover:text-white text-lg font-bold transition cursor-pointer"
                >
                  {t('Exit TV View')}
                </button>
              )}
            </div>
        </div>
      </footer>

      {/* Azan Voices (remote-friendly): default voice + one per prayer */}
      {openDialog === 'azan' && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center px-[96px] py-[54px] bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-[1300px] max-h-full flex flex-col rounded-[36px] bg-[var(--tv-dialog)] border border-amber-500/30 p-10 shadow-2xl">
            <div className="flex items-center justify-between pb-5 mb-3 border-b border-white/10">
              <div>
                <h3 className="font-serif text-[48px] leading-tight font-bold text-white">{t('Azan Voices')}</h3>
                <p className="text-[22px] text-neutral-400">{t('Press OK on Change to pick a voice for each prayer')}</p>
              </div>
              <button
                onClick={closeDialog}
                className="p-4 rounded-2xl bg-white/10 hover:bg-white/20 text-neutral-200 cursor-pointer"
                title={t('Close')}
              >
                <X className="w-8 h-8" />
              </button>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto p-2">
              {[{ key: 'default', label: t('Default (all prayers)') }, ...AZAN_PRAYERS.map((p) => ({ key: p, label: i18n.prayer(p) }))].map((row, index) => {
                const isDefaultRow = row.key === 'default';
                const own = isDefaultRow ? null : azanSettings.prayerMuezzins?.[row.key as AzanPrayer];
                const effective = isDefaultRow ? azanSettings.selectedMuezzin : getMuezzinForPrayer(azanSettings, row.key);
                const isPreviewing = previewingRow === row.key;
                return (
                  <div
                    key={row.key}
                    className={`flex items-center gap-6 px-7 py-2.5 rounded-3xl border ${
                      isDefaultRow ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="w-[300px] shrink-0 text-[28px] font-bold text-white">{row.label}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[26px] font-semibold text-amber-200 truncate">
                        {t(MUEZZIN_SOURCES[effective].name)}
                      </div>
                      <div className="text-[20px] text-neutral-400">
                        {isDefaultRow ? t('Used by every prayer set to Default') : own ? t(MUEZZIN_SOURCES[own].location) : t('Default')}
                      </div>
                    </div>
                    <button
                      ref={index === 0 ? azanDialogFirstButtonRef : undefined}
                      onClick={() => (isDefaultRow ? cycleDefaultMuezzin() : cyclePrayerMuezzin(row.key as AzanPrayer))}
                      className="px-7 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-[22px] font-bold text-white cursor-pointer"
                      title={t('Change {name} voice', { name: row.label })}
                    >
                      {t('Change')}
                    </button>
                    {!isDefaultRow && iqamahOn && (
                      <button
                        onClick={() => toggleIqamahFor(row.key as AzanPrayer)}
                        aria-pressed={iqamahFor(row.key as AzanPrayer)}
                        className={`min-w-[170px] px-5 py-3 rounded-2xl text-[20px] font-bold text-center whitespace-nowrap cursor-pointer ${
                          iqamahFor(row.key as AzanPrayer) ? 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30' : 'bg-white/5 text-neutral-500 hover:bg-white/15'
                        }`}
                        title={t('Turn the {prayer} Iqamah on or off', { prayer: row.label })}
                      >
                        {t(iqamahFor(row.key as AzanPrayer) ? 'Iqamah on' : 'Iqamah off')}
                      </button>
                    )}
                    <button
                      onClick={() => togglePreview(row.key, effective)}
                      className={`p-4 rounded-2xl cursor-pointer ${isPreviewing ? 'bg-rose-500 text-white' : 'bg-amber-500 text-neutral-950'}`}
                      title={t(isPreviewing ? 'Stop {name} preview' : 'Listen to {name} voice', { name: row.label })}
                    >
                      {isPreviewing ? <Square className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current" />}
                    </button>
                  </div>
                );
              })}
              {/* The Iqamah, played when the Iqamah countdown ends */}
              <div className="flex items-center gap-6 px-7 py-2.5 rounded-3xl border bg-emerald-500/10 border-emerald-500/30">
                <div className="w-[300px] shrink-0 text-[28px] font-bold text-white">{t('Iqamah')}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[26px] font-semibold text-amber-200 truncate">{t(IQAMAH_SOURCE.name)}</div>
                  <div className="text-[20px] text-neutral-400">{t(iqamahOn ? 'Plays when the Iqamah countdown ends' : 'Off')}</div>
                </div>
                <button
                  onClick={() => updateAzanSettings({ ...azanSettings, iqamahSound: !iqamahOn })}
                  aria-pressed={iqamahOn}
                  className={`px-7 py-3 rounded-2xl text-[22px] font-bold cursor-pointer ${
                    iqamahOn ? 'bg-emerald-500/25 text-emerald-200 hover:bg-emerald-500/35' : 'bg-white/10 text-neutral-300 hover:bg-white/20'
                  }`}
                  title={t('Turn the Iqamah on or off')}
                >
                  {t(iqamahOn ? 'On' : 'Off')}
                </button>
                <button
                  onClick={() => togglePreview('iqamah', 'iqamah')}
                  className={`p-4 rounded-2xl cursor-pointer ${previewingRow === 'iqamah' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-neutral-950'}`}
                  title={t(previewingRow === 'iqamah' ? 'Stop the Iqamah preview' : 'Listen to the Iqamah')}
                >
                  {previewingRow === 'iqamah' ? <Square className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current" />}
                </button>
              </div>
              {/* The Du'a after the Azan: which recitation (shown once there is more than one) */}
              {DUA_IDS.length > 1 && (
                <div className="flex items-center gap-6 px-7 py-2.5 rounded-3xl border bg-white/5 border-white/10">
                  <div className="w-[300px] shrink-0 text-[28px] font-bold text-white">{t("Du'a after Azan")}</div>
                  <div className="relative flex-1 min-w-0">
                    <button
                      ref={duaButtonRef}
                      onClick={() => (duaMenuOpen ? closeDuaMenu() : openDuaMenu())}
                      aria-haspopup="listbox"
                      aria-expanded={duaMenuOpen}
                      className="w-full flex items-center gap-4 px-6 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-start cursor-pointer"
                      title={t("Change the Du'a recitation")}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[26px] font-semibold text-amber-200 truncate">{t(DUA_SOURCES[getDuaForSettings(azanSettings)].name)}</div>
                        <div className="text-[20px] text-neutral-400 truncate">{t(DUA_SOURCES[getDuaForSettings(azanSettings)].location)}</div>
                      </div>
                      <ChevronDown className={`w-8 h-8 shrink-0 text-neutral-300 transition-transform ${duaMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {/* Its own dialog so the remote's arrows stay in the list; Back closes just the list */}
                    {duaMenuOpen && (
                      <div
                        ref={duaMenuRef}
                        role="dialog"
                        aria-label={t("Du'a after Azan")}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack') {
                            e.preventDefault();
                            e.nativeEvent.stopPropagation();
                            closeDuaMenu();
                          }
                        }}
                        onBlur={(e) => {
                          // Focus left the list (e.g. a click elsewhere); the toggle button handles itself
                          const to = e.relatedTarget as Node | null;
                          if (duaMenuOpenRef.current && !e.currentTarget.contains(to) && to !== duaButtonRef.current) closeDuaMenu();
                        }}
                        className="absolute bottom-full inset-x-0 mb-2 z-10 flex flex-col gap-1 p-2 rounded-2xl bg-[var(--tv-dialog)] border border-amber-500/40 shadow-2xl"
                      >
                        <div role="listbox" className="flex flex-col gap-1">
                          {DUA_IDS.map((id) => {
                            const chosen = id === getDuaForSettings(azanSettings);
                            return (
                              <button
                                key={id}
                                ref={chosen ? duaChosenOptionRef : undefined}
                                role="option"
                                aria-selected={chosen}
                                onClick={() => chooseDua(id)}
                                className={`flex items-center gap-4 px-5 py-2.5 rounded-xl text-start cursor-pointer ${
                                  chosen ? 'bg-amber-500/20' : 'hover:bg-white/10 focus:bg-white/10'
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-[24px] font-semibold text-white truncate">{t(DUA_SOURCES[id].name)}</div>
                                  <div className="text-[18px] text-neutral-400 truncate">{t(DUA_SOURCES[id].location)}</div>
                                </div>
                                {chosen && <Check className="w-7 h-7 shrink-0 text-amber-300" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => updateAzanSettings({ ...azanSettings, duaAfterAzan: !duaOn })}
                    aria-pressed={duaOn}
                    className={`px-7 py-3 rounded-2xl text-[22px] font-bold cursor-pointer ${
                      duaOn ? 'bg-emerald-500/25 text-emerald-200 hover:bg-emerald-500/35' : 'bg-white/10 text-neutral-300 hover:bg-white/20'
                    }`}
                    title={t("Turn the Du'a after the Azan on or off")}
                  >
                    {t(duaOn ? 'On' : 'Off')}
                  </button>
                  <button
                    onClick={() => togglePreview('dua', 'dua')}
                    className={`p-4 rounded-2xl cursor-pointer ${previewingRow === 'dua' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-neutral-950'}`}
                    title={t(previewingRow === 'dua' ? "Stop the Du'a preview" : "Listen to the Du'a")}
                  >
                    {previewingRow === 'dua' ? <Square className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Language: the screen and the Hadith text separately */}
      {openDialog === 'language' && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center px-[96px] py-[54px] bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-[1100px] max-h-full flex flex-col rounded-[36px] bg-[var(--tv-dialog)] border border-amber-500/30 p-10 shadow-2xl">
            <div className="flex items-center justify-between pb-6 mb-6 border-b border-white/10">
              <div>
                <h3 className="font-serif text-[48px] leading-tight font-bold text-white">{t('Language')}</h3>
                <p className="text-[22px] text-neutral-400">{t('Choose what is shown in Arabic')}</p>
              </div>
              <button onClick={closeDialog} className="p-4 rounded-2xl bg-white/10 hover:bg-white/20 text-neutral-200 cursor-pointer" title={t('Close')}>
                <X className="w-8 h-8" />
              </button>
            </div>
            <div className="flex flex-col gap-6">
              {(
                [
                  { label: t('Screen (menus, prayer times, dates)'), value: uiLanguage, set: setUiLanguage },
                  { label: t('Hadith text'), value: hadithLanguage, set: setHadithLanguage }
                ] as { label: string; value: HadithLanguage; set: (l: HadithLanguage) => void }[]
              ).map((row, rowIndex) => (
                <div key={rowIndex} className="flex items-center justify-between gap-6 px-7 py-5 rounded-3xl bg-white/5 border border-white/10">
                  <span className="text-[28px] font-semibold text-white">{row.label}</span>
                  <div className="flex gap-3">
                    {(['en', 'ar'] as const).map((lang, i) => (
                      <button
                        key={lang}
                        ref={rowIndex === 0 && i === 0 ? languageFirstButtonRef : undefined}
                        onClick={() => row.set(lang)}
                        aria-pressed={row.value === lang}
                        className={`px-8 py-4 rounded-2xl text-[26px] font-bold cursor-pointer ${lang === 'ar' ? 'font-arabic' : ''} ${
                          row.value === lang ? 'bg-amber-500 text-neutral-950' : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                      >
                        {lang === 'ar' ? 'العربية' : 'English'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hadith topic for the slides */}
      {openDialog === 'topic' && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center px-[96px] py-[54px] bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-[1300px] max-h-full flex flex-col rounded-[36px] bg-[var(--tv-dialog)] border border-amber-500/30 p-10 shadow-2xl">
            <div className="flex items-center justify-between pb-6 mb-6 border-b border-white/10">
              <div>
                <h3 className="font-serif text-[48px] leading-tight font-bold text-white">{t('Hadith topic for the slides')}</h3>
                <p className="text-[22px] text-neutral-400">{t('Topics are found by keyword, so a few Hadiths may only mention the topic.')}</p>
              </div>
              <button onClick={closeDialog} className="p-4 rounded-2xl bg-white/10 hover:bg-white/20 text-neutral-200 cursor-pointer" title={t('Close')}>
                <X className="w-8 h-8" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4 overflow-y-auto p-2">
              {[null, ...topics.map((x) => x.id)].map((id) => {
                const item = topics.find((x) => x.id === id);
                const selected = id === topic;
                return (
                  <button
                    key={id ?? 'all'}
                    ref={selected ? topicButtonRef : undefined}
                    onClick={() => {
                      setTopic(id);
                      saveTvTopic(id);
                      closeDialog();
                      if (id) {
                        pickRandomHadith(id).then((h) => showHadith(h, false));
                      }
                    }}
                    className={`px-6 py-5 rounded-3xl border text-[26px] font-semibold text-start cursor-pointer ${
                      selected ? 'bg-amber-500/20 border-amber-400 text-white' : 'bg-white/5 border-white/10 text-neutral-200 hover:bg-white/10'
                    }`}
                  >
                    {item ? (i18n.isArabic ? item.nameAr : item.name) : t('All topics')}
                    {item && <div className="text-[18px] text-neutral-400 mt-1">{t('{n} Hadiths', { n: item.positions.length })}</div>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mosque Picker (remote-friendly) */}
      {isMosquePickerOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center px-[96px] py-[54px] bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-[1500px] max-h-full flex flex-col rounded-[36px] bg-[var(--tv-dialog)] border border-amber-500/30 p-10 shadow-2xl">
            <div className="flex items-center justify-between pb-6 mb-6 border-b border-white/10">
              <div className="space-y-3">
                <h3 className="font-serif text-[48px] font-bold text-white">{t('Choose Your Mosque')}</h3>
                <HijriAdjust size="tv" />
              </div>
              <button
                onClick={closeDialog}
                className="p-4 rounded-2xl bg-white/10 hover:bg-white/20 text-neutral-200 cursor-pointer"
                title={t('Close')}
              >
                <X className="w-8 h-8" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4 overflow-y-auto pr-2 p-2">
              {mosquesByState.map((m) => {
                const isSelected = m.id === selectedMosque.id;
                return (
                  <button
                    key={m.id}
                    ref={isSelected ? selectedMosqueButtonRef : undefined}
                    onClick={() => handleSelectMosque(m)}
                    className={`text-start px-6 py-5 rounded-3xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-white'
                        : 'bg-white/5 border-white/10 text-neutral-200 hover:bg-white/10'
                    }`}
                  >
                    <div className="font-semibold text-[24px] leading-snug">{m.name}</div>
                    <div className="text-[20px] text-neutral-400 mt-1">{m.suburb}, {m.state}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {openDialog === 'quran' && <QuranDialog player={quran} i18n={i18n} onClose={closeDialog} onPlay={closeQuranDialogAndPlay} onStop={stopQuranFromDialog} />}

      {/* Iqamah countdown after the Adhan, then "prayer in progress" (Friday Dhuhr is Jumu'ah) */}
      {(() => {
        const phase = prayerPhase;
        return phase && phase.key !== dismissedPhase && !openDialog ? (
          <PrayerPhaseOverlay phase={phase} i18n={i18n} onDismiss={() => setDismissedPhase(phase.key)} />
        ) : null;
      })()}

      {/* Brightness: dims everything, dialogs included, without blocking the remote */}
      {effectiveBrightness < 100 && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[9999] bg-black pointer-events-none transition-opacity duration-300"
          style={{ opacity: (100 - effectiveBrightness) / 100 }}
        />
      )}
    </div>
  );
};
