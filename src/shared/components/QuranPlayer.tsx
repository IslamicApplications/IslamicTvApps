import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Languages, Pause, Play, Repeat, Square, X } from 'lucide-react';
import {
  BISMILLAH,
  arabicVolume,
  QuranPosition,
  QuranSettings,
  RECITERS,
  SURAHS,
  Surah,
  SurahText,
  VerseTiming,
  canAddEnglish,
  englishVerseUrl,
  getQuranPosition,
  getQuranSettings,
  hasVerseTimings,
  isEnglishReciter,
  loadRecitation,
  loadSurahText,
  resumeAfterEnglish,
  resumeStartSeconds,
  resumeTrack,
  saveQuranPosition,
  saveQuranSettings,
  verseAt,
  verseToTranslate
} from '../utils/quran';
import { I18n } from '../i18n';

export interface QuranPlayer {
  settings: QuranSettings;
  updateSettings: (changes: Partial<QuranSettings>) => void;
  /** A surah is loaded (playing, paused or loading) */
  active: boolean;
  playing: boolean;
  loading: boolean;
  error: string | null;
  pausedForPrayer: boolean;
  surah: Surah;
  verseIndex: number;
  /** The recitation has verse timings, so the verse being recited can be shown */
  timed: boolean;
  verseCount: number;
  progress: number;
  text: SurahText | null;
  /** Starts a surah, from the beginning or from a saved position in it */
  play: (surah?: number, from?: QuranPosition | null) => void;
  /** Carries on from where the recitation was paused or stopped */
  resume: () => void;
  toggle: () => void;
  /** After the prayer: carries on from where it paused for it */
  continueAfterPrayer: () => void;
  stop: () => void;
  next: () => void;
  previous: () => void;
  pauseForPrayer: () => void;
}

/** One Quran audio player for the TV, separate from the Azan's. */
export function useQuranPlayer(): QuranPlayer {
  const [settings, setSettings] = useState<QuranSettings>(getQuranSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pausedForPrayer, setPausedForPrayer] = useState(false);
  const [verseIndex, setVerseIndex] = useState(0);
  const [timed, setTimed] = useState(true);
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState<SurahText | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timingsRef = useRef<VerseTiming[]>([]);
  // A reciter with one file per verse: the files and the one playing (its verse index)
  const tracksRef = useRef<string[] | null>(null);
  const trackRef = useRef(0);
  /** With the Arabic and its translation as separate files: files per verse, and the translation's volume */
  const filesPerVerseRef = useRef(1);
  const translationVolumeRef = useRef(1);
  const trackVerse = () => Math.floor(trackRef.current / filesPerVerseRef.current);
  // English after each verse: a second player, the verse (index) it is reading or null
  // while the Arabic plays, the last verse read in English, and whether the surah ends after it
  const englishAudioRef = useRef<HTMLAudioElement | null>(null);
  const englishVerseRef = useRef<number | null>(null);
  const englishDoneRef = useRef(-1);
  const finishAfterEnglishRef = useRef(false);
  // Increases with every play/stop, so a slow request for an older surah is ignored
  const tokenRef = useRef(0);
  // The surah and reciter in the audio element, once its recitation has loaded
  const loadedRef = useRef<{ surah: number; reciter: number } | null>(null);
  const lastSaveRef = useRef(0);
  const activeRef = useRef(active);
  activeRef.current = active;
  const pausedForPrayerRef = useRef(pausedForPrayer);
  pausedForPrayerRef.current = pausedForPrayer;
  // Pause pressed (not the browser pausing a hidden page), so showing the page again doesn't play
  const userPausedRef = useRef(false);

  /** Remembers the exact place in the surah (also across reloads) */
  const savePosition = () => {
    const audio = audioRef.current;
    const loaded = loadedRef.current;
    if (!audio || !loaded || !(audio.currentTime > 0)) return;
    if (tracksRef.current) {
      // The time is within the verse's own file; in its translation, the verse starts again
      const first = trackRef.current % filesPerVerseRef.current === 0;
      saveQuranPosition({ ...loaded, time: first ? audio.currentTime : 0, verse: trackVerse() + 1 });
      return;
    }
    // While a verse's English is read, the Arabic waits at the verse's end: save a moment
    // before it, so carrying on (after a reload or a dropped connection) reads that English again
    const english = englishVerseRef.current !== null ? timingsRef.current[englishVerseRef.current] : undefined;
    const time = english ? Math.min(audio.currentTime, Math.max(english.from, english.to - 100) / 1000) : audio.currentTime;
    const timing = timingsRef.current[verseAt(timingsRef.current, time * 1000)];
    saveQuranPosition({ ...loaded, time, verse: timing ? timing.verse : 1 });
  };

  const updateSettings = useCallback((changes: Partial<QuranSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...changes };
      saveQuranSettings(next);
      return next;
    });
  }, []);

  const getAudio = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
    }
    return audioRef.current;
  };

  const getEnglishAudio = () => {
    if (!englishAudioRef.current) {
      englishAudioRef.current = new Audio();
      englishAudioRef.current.preload = 'auto';
    }
    return englishAudioRef.current;
  };

  /** The player the remote controls: the English while a verse's translation is read */
  const currentAudio = () => (englishVerseRef.current !== null ? englishAudioRef.current : audioRef.current);

  const stopEnglish = () => {
    englishVerseRef.current = null;
    const english = englishAudioRef.current;
    if (english) {
      english.pause();
      english.removeAttribute('src');
      english.load();
    }
  };

  const stop = useCallback(() => {
    tokenRef.current++;
    savePosition();
    loadedRef.current = null;
    stopEnglish();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setActive(false);
    setPlaying(false);
    setLoading(false);
    setPausedForPrayer(false);
    setError(null);
  }, []);

  const play = useCallback(
    async (surahNumber?: number, from?: QuranPosition | null) => {
      const n = surahNumber ?? settingsRef.current.surah;
      if (from?.surah !== n) from = null;
      const reciter = settingsRef.current.reciter;
      const token = ++tokenRef.current;
      const audio = getAudio();
      audio.pause();
      stopEnglish();
      // Without the old surah's src, Play pressed while this one loads can't resume the old one
      audio.removeAttribute('src');
      loadedRef.current = null;
      userPausedRef.current = false;
      updateSettings({ surah: n });
      setActive(true);
      setLoading(true);
      setError(null);
      setPausedForPrayer(false);
      setVerseIndex(from ? from.verse - 1 : 0);
      setProgress(0);
      setText(null);
      timingsRef.current = [];
      tracksRef.current = null;
      loadSurahText(n)
        .then((t) => token === tokenRef.current && setText(t))
        .catch(() => {});
      try {
        const recitation = await loadRecitation(reciter, n);
        if (token !== tokenRef.current) return;
        timingsRef.current = recitation.timings;
        tracksRef.current = recitation.tracks ?? null;
        filesPerVerseRef.current = recitation.filesPerVerse ?? 1;
        translationVolumeRef.current = recitation.translationVolume ?? 1;
        trackRef.current = recitation.tracks
          ? resumeTrack(from, n, recitation.tracks.length / filesPerVerseRef.current) * filesPerVerseRef.current
          : 0;
        setTimed(recitation.timings.length > 0 || !!recitation.tracks);
        loadedRef.current = { surah: n, reciter };
        audio.volume = arabicVolume(reciter, settingsRef.current.englishAfterVerse);
        audio.src = recitation.tracks ? recitation.tracks[trackRef.current] : recitation.url;
        const start = resumeStartSeconds(from, n, reciter, recitation.timings);
        // The English follows the verses from here on (not those before the place it carries on from)
        englishDoneRef.current = verseAt(recitation.timings, start * 1000) - 1;
        preloadEnglishRef.current();
        if (start > 0) {
          await new Promise<void>((resolve) => {
            const done = () => {
              audio.removeEventListener('loadedmetadata', done);
              audio.removeEventListener('error', done);
              resolve();
            };
            audio.addEventListener('loadedmetadata', done);
            audio.addEventListener('error', done);
          });
          if (token !== tokenRef.current) return;
          if (audio.duration && start < audio.duration - 1) audio.currentTime = start;
        }
        await audio.play();
      } catch (err: any) {
        if (token !== tokenRef.current || err?.name === 'AbortError') return;
        setLoading(false);
        setError('Could not load the recitation. Check the internet connection.');
      }
    },
    [updateSettings]
  );

  // A TV can deliver one remote press both as a key and as a media-session action
  const lastCommandRef = useRef({ name: '', at: 0 });
  const isRepeat = (name: string) => {
    const now = Date.now();
    const repeat = lastCommandRef.current.name === name && now - lastCommandRef.current.at < 400;
    lastCommandRef.current = { name, at: now };
    return repeat;
  };

  const resume = useCallback(() => {
    const surahNumber = settingsRef.current.surah;
    play(surahNumber, getQuranPosition());
  }, [play]);
  const resumeRef = useRef(resume);
  resumeRef.current = resume;

  const toggle = useCallback(() => {
    if (isRepeat('toggle')) return;
    const audio = currentAudio();
    // Nothing loaded, or the stream broke (e.g. the connection dropped during a long pause): reload at the saved place
    if (!active || !audio?.getAttribute('src') || error || audio.error) {
      resume();
      return;
    }
    setPausedForPrayer(false);
    if (audio.paused) {
      userPausedRef.current = false;
      audio.play().catch((err) => {
        if (err?.name !== 'AbortError') resume();
      });
    } else {
      userPausedRef.current = true;
      audio.pause();
    }
  }, [active, error, resume]);

  const continueAfterPrayer = useCallback(() => {
    const audio = currentAudio();
    setPausedForPrayer(false);
    // The stream may have timed out during the prayer: then reload at the saved place
    if (!audio?.getAttribute('src') || audio.error || error) {
      resume();
      return;
    }
    userPausedRef.current = false;
    audio.play().catch((err) => {
      if (err?.name !== 'AbortError') resume();
    });
  }, [error, resume]);

  const next = useCallback(() => {
    if (!isRepeat('next')) play(settingsRef.current.surah >= 114 ? 1 : settingsRef.current.surah + 1);
  }, [play]);
  const previous = useCallback(() => {
    if (!isRepeat('previous')) play(settingsRef.current.surah <= 1 ? 114 : settingsRef.current.surah - 1);
  }, [play]);

  const pauseForPrayer = useCallback(() => {
    const audio = currentAudio();
    if (audio && !audio.paused) {
      audio.pause();
      setPausedForPrayer(true);
    }
  }, []);

  // Audio events; the handlers read the latest settings through refs
  const nextRef = useRef(next);
  nextRef.current = next;
  const stopRef = useRef(stop);
  stopRef.current = stop;
  // Runs often while the Arabic plays with the English on (timeupdate alone comes only ~4 times a second)
  const checkEnglishRef = useRef(() => {});
  const preloadEnglishRef = useRef(() => {});
  const endEnglishRef = useRef((_resume: boolean) => {});
  useEffect(() => {
    const audio = getAudio();
    const english = getEnglishAudio();

    const finishSurah = () => {
      // Finished: nothing to carry on from
      loadedRef.current = null;
      saveQuranPosition(null);
      if (settingsRef.current.continuous) {
        lastCommandRef.current = { name: '', at: 0 };
        nextRef.current();
      }
      else stopRef.current();
    };

    const englishOn = () =>
      settingsRef.current.englishAfterVerse && !!loadedRef.current && canAddEnglish(loadedRef.current.reciter);

    /** The Arabic of verse `index` has ended: pause it and read the verse in English */
    const startEnglish = (index: number, finishAfter: boolean) => {
      const timing = timingsRef.current[index];
      const loaded = loadedRef.current;
      if (!timing || !loaded) return;
      englishVerseRef.current = index;
      englishDoneRef.current = index;
      finishAfterEnglishRef.current = finishAfter;
      audio.pause();
      setVerseIndex(index);
      // Usually loaded already, while the Arabic was recited (preloadEnglish)
      const url = englishVerseUrl(loaded.surah, timing.verse);
      // (and fetched again if that load failed, e.g. the connection dropped for a moment)
      if (english.src !== url || english.error) english.src = url;
      english.play().catch((err) => {
        if (err?.name !== 'AbortError') endEnglish();
      });
    };

    /**
     * The English has been read (or couldn't be, or was turned off): on with the Arabic, or
     * the surah is over. Without `resume` (turned off while paused) the Arabic waits for Play.
     */
    const endEnglish = (resume = true) => {
      const index = englishVerseRef.current;
      if (index === null) return;
      englishVerseRef.current = null;
      english.pause();
      // Back to a moment before the verse's end (resumeAfterEnglish)
      const timing = timingsRef.current[index];
      if (timing) audio.currentTime = resumeAfterEnglish(timing, audio.currentTime);
      if (finishAfterEnglishRef.current) {
        if (resume) finishSurah();
        else {
          // Paused on the last verse: the Arabic has ended, so Play would start the surah again
          loadedRef.current = null;
          saveQuranPosition(null);
          stopRef.current();
        }
      } else if (resume) {
        audio.play().catch(() => {});
      }
      preloadEnglish();
    };
    endEnglishRef.current = endEnglish;

    /**
     * Loads the next verse's English into the (idle) English player while the Arabic is
     * recited, so it starts the moment the verse ends instead of after a download.
     */
    const preloadEnglish = () => {
      const loaded = loadedRef.current;
      const timing = timingsRef.current[englishDoneRef.current + 1];
      if (englishVerseRef.current !== null || !loaded || !timing || !englishOn()) return;
      const url = englishVerseUrl(loaded.surah, timing.verse);
      if (english.src !== url) {
        english.src = url;
        english.load();
      }
    };
    preloadEnglishRef.current = preloadEnglish;
    const onEnglishDone = () => endEnglish();

    checkEnglishRef.current = () => {
      if (englishVerseRef.current !== null || tracksRef.current || audio.paused || !englishOn()) return;
      const timings = timingsRef.current;
      const index = verseToTranslate(timings, audio.currentTime * 1000, englishDoneRef.current);
      if (index !== null) startEnglish(index, false);
    };
    const onPlaying = () => {
      setPlaying(true);
      setLoading(false);
    };
    const onPause = () => {
      setPlaying(false);
      savePosition();
    };
    const onWaiting = () => setLoading(true);
    const onTime = () => {
      const tracks = tracksRef.current;
      if (tracks) {
        setVerseIndex(trackVerse());
        const withinVerse = audio.duration ? audio.currentTime / audio.duration : 0;
        setProgress(Math.round(((trackRef.current + withinVerse) / tracks.length) * 1000) / 1000);
      } else if (englishVerseRef.current === null) {
        const ms = audio.currentTime * 1000;
        const timing = timingsRef.current[verseAt(timingsRef.current, ms)];
        setVerseIndex(timing ? timing.verse - 1 : 0);
        // Rounded so the screen re-renders only when the bar visibly moves
        if (audio.duration) setProgress(Math.round((audio.currentTime / audio.duration) * 1000) / 1000);
      }
      checkEnglishRef.current();
      if (!audio.paused && Date.now() - lastSaveRef.current > 3000) {
        lastSaveRef.current = Date.now();
        savePosition();
      }
    };
    const onEnded = () => {
      // The last verse's English is still to be read
      const last = timingsRef.current.length - 1;
      if (!tracksRef.current && englishOn() && englishDoneRef.current < last) {
        startEnglish(last, true);
        return;
      }
      // One file per verse: on to the next verse's
      const tracks = tracksRef.current;
      if (tracks && trackRef.current < tracks.length - 1) {
        trackRef.current++;
        setVerseIndex(trackVerse());
        if (filesPerVerseRef.current > 1) {
          audio.volume = trackRef.current % filesPerVerseRef.current === 0 ? 1 : translationVolumeRef.current;
        }
        audio.src = tracks[trackRef.current];
        audio.play().catch((err) => {
          if (err?.name !== 'AbortError') onError();
        });
        return;
      }
      finishSurah();
    };
    const onError = () => {
      if (!audio.getAttribute('src')) return;
      savePosition();
      setLoading(false);
      setPlaying(false);
      setError('Could not load the recitation. Check the internet connection.');
    };
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    // The English player's events
    const onEnglishPlaying = () => {
      setPlaying(true);
      setLoading(false);
    };
    const onEnglishPause = () => {
      if (englishVerseRef.current !== null) setPlaying(false);
    };
    english.addEventListener('playing', onEnglishPlaying);
    english.addEventListener('pause', onEnglishPause);
    english.addEventListener('waiting', onWaiting);
    english.addEventListener('ended', onEnglishDone);
    // A verse that won't load is skipped, not the recitation
    english.addEventListener('error', onEnglishDone);
    return () => {
      english.removeEventListener('playing', onEnglishPlaying);
      english.removeEventListener('pause', onEnglishPause);
      english.removeEventListener('waiting', onWaiting);
      english.removeEventListener('ended', onEnglishDone);
      english.removeEventListener('error', onEnglishDone);
      english.pause();
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
    };
  }, []);

  const englishCanPlay = settings.englishAfterVerse && active && !!loadedRef.current && canAddEnglish(loadedRef.current.reciter);
  useEffect(() => {
    if (!playing || !englishCanPlay) return;
    const timer = setInterval(() => checkEnglishRef.current(), 50);
    return () => clearInterval(timer);
  }, [playing, englishCanPlay]);

  // Turned on part way through a surah: the English starts with the verse being recited.
  // Turned off while a translation is read: back to the Arabic.
  useEffect(() => {
    const audio = audioRef.current;
    if (audio && loadedRef.current) audio.volume = arabicVolume(loadedRef.current.reciter, settings.englishAfterVerse);
    if (settings.englishAfterVerse) {
      if (audio && englishVerseRef.current === null) englishDoneRef.current = verseAt(timingsRef.current, audio.currentTime * 1000) - 1;
      preloadEnglishRef.current();
    } else {
      endEnglishRef.current(!englishAudioRef.current?.paused);
    }
  }, [settings.englishAfterVerse]);

  // The TV or browser pausing the audio while the app is hidden (another app, the TV's
  // screensaver, a minimised window): carry on from the same place when it's shown again
  useEffect(() => {
    let playingWhenHidden = false;
    const onVisibility = () => {
      const audio = currentAudio();
      if (!audio) return;
      if (document.visibilityState === 'hidden') {
        playingWhenHidden = !audio.paused;
        userPausedRef.current = false;
        savePosition();
        return;
      }
      if (!playingWhenHidden) return;
      playingWhenHidden = false;
      if (!audio.paused || userPausedRef.current || pausedForPrayerRef.current || !activeRef.current) return;
      if (audio.getAttribute('src') && !audio.error) audio.play().catch(() => resumeRef.current());
      else resumeRef.current();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', savePosition);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', savePosition);
    };
  }, []);

  const surah = SURAHS[settings.surah - 1];
  const reciter = RECITERS.find((r) => r.id === settings.reciter) ?? RECITERS[0];

  // The remote's media keys (play/pause, next/previous track) through the Media Session API
  useEffect(() => {
    const session = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!session) return;
    const actions: MediaSessionAction[] = ['play', 'pause', 'nexttrack', 'previoustrack', 'stop'];
    if (!active) {
      // Stopped: the remote's media keys must not start it again
      try {
        session.metadata = null;
        for (const action of actions) session.setActionHandler(action, null);
      } catch {}
      return;
    }
    try {
      session.metadata = new MediaMetadata({ title: `${surah.ar} • ${surah.en}`, artist: reciter.name, album: 'Quran' });
      session.setActionHandler('play', toggle);
      session.setActionHandler('pause', toggle);
      session.setActionHandler('nexttrack', next);
      session.setActionHandler('previoustrack', previous);
      session.setActionHandler('stop', stop);
    } catch {}
  }, [active, surah, reciter, toggle, next, previous, stop]);

  return {
    settings,
    updateSettings,
    active,
    playing,
    loading,
    error,
    pausedForPrayer,
    surah,
    verseIndex,
    timed,
    verseCount: surah.verses,
    progress,
    text,
    play,
    resume,
    toggle,
    continueAfterPrayer,
    stop,
    next,
    previous,
    pauseForPrayer
  };
}

/** 125 -> "2:05", 3725 -> "1:02:05" */
export function formatDuration(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export function reciterName(id: number, i18n: I18n): string {
  const reciter = RECITERS.find((r) => r.id === id) ?? RECITERS[0];
  return i18n.isArabic ? reciter.nameAr : reciter.name;
}

/** Verse text sizes, largest first; a long verse steps down until it fits the panel */
const VERSE_SIZES = [64, 56, 48, 42, 36, 31, 27, 23, 20];

interface QuranNowPlayingProps {
  player: QuranPlayer;
  i18n: I18n;
  showTranslation: boolean;
  onChoose: () => void;
}

/** Fills the Hadith panel while the Quran is playing: the verse being recited, with controls. */
export const QuranNowPlaying: React.FC<QuranNowPlayingProps> = ({ player, i18n, showTranslation, onChoose }) => {
  const { t } = i18n;
  const { surah, text, verseIndex } = player;
  // Without verse timings the verse isn't known: show the surah's name instead
  const arabic = player.timed ? text?.arabic[verseIndex] : undefined;
  const english = player.timed ? text?.english[verseIndex] : undefined;
  const verseNumber = verseIndex + 1;
  const showBismillah = player.timed && verseIndex === 0 && surah.bismillah && surah.n !== 1;
  // English audio (a reading, or after each verse) shows its translation whatever the Hadith language
  const englishAudio = isEnglishReciter(player.settings.reciter) || (player.settings.englishAfterVerse && canAddEnglish(player.settings.reciter));
  const translationShown = (showTranslation || englishAudio) && english && (arabic?.length ?? 0) < 520;
  const verseAreaRef = useRef<HTMLDivElement>(null);
  const [sizeStep, setSizeStep] = useState(0);
  useLayoutEffect(() => setSizeStep(0), [arabic, translationShown]);
  useLayoutEffect(() => {
    const area = verseAreaRef.current;
    if (area && area.scrollHeight > area.clientHeight + 1 && sizeStep < VERSE_SIZES.length - 1) setSizeStep(sizeStep + 1);
  }, [sizeStep, arabic, translationShown]);
  const fontSize = VERSE_SIZES[sizeStep];

  const status = player.error
    ? t(player.error)
    : player.pausedForPrayer
    ? t('Paused for the prayer')
    : player.loading
    ? t('Loading…')
    : !player.playing
    ? t('Paused')
    : null;

  const controlClass = 'p-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white cursor-pointer';

  return (
    <div className="absolute inset-0 z-20 bg-[var(--tv-panel)] backdrop-blur-md flex flex-col px-12 py-9">
      <div className="shrink-0 flex items-center justify-between gap-6">
        <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[22px] font-bold whitespace-nowrap">
          <BookOpen className="w-6 h-6" />
          <span>{t('Quran Recitation')}</span>
        </div>
        <div className="text-end min-w-0">
          <div className="text-[34px] font-bold text-white whitespace-nowrap">
            <span className="font-arabic">سورة {surah.ar}</span>
            {!i18n.isArabic && <span className="text-neutral-400 text-[24px] font-semibold"> • {surah.en} ({surah.meaning})</span>}
          </div>
          <div className="text-[20px] text-neutral-400 truncate">{reciterName(player.settings.reciter, i18n)}</div>
        </div>
      </div>

      <div ref={verseAreaRef} className="flex-1 min-h-0 flex flex-col items-center justify-center gap-6 overflow-hidden text-center py-4">
        {showBismillah && <div className="font-arabic text-[40px] text-amber-300/90">{BISMILLAH}</div>}
        {arabic ? (
          <p dir="rtl" lang="ar" data-latin-digits className="font-arabic leading-[1.7] text-white" style={{ fontSize }}>
            {arabic} <span className="text-amber-400 whitespace-nowrap">﴿{verseNumber.toLocaleString('ar-EG')}﴾</span>
          </p>
        ) : (
          <p className="font-arabic text-[64px] text-white/80">سورة {surah.ar}</p>
        )}
        {translationShown && (
          <p dir="ltr" lang="en" className="font-serif leading-snug text-neutral-300 max-w-[95%]" style={{ fontSize: Math.min(28, Math.max(20, fontSize * 0.5)) }}>
            {english} <span className="text-neutral-500">({surah.n}:{verseNumber})</span>
          </p>
        )}
      </div>

      <div className="shrink-0 flex flex-col gap-4">
        <div className="h-2 rounded-full bg-white/10 overflow-hidden" dir="ltr">
          <div className="h-full bg-emerald-400 transition-[width] duration-500" style={{ width: `${Math.round(player.progress * 1000) / 10}%` }} />
        </div>
        <div className="flex items-center justify-between gap-6">
          <div className="text-[22px] text-neutral-300 whitespace-nowrap">
            {player.timed && t('Verse {n} of {total}', { n: verseNumber, total: player.verseCount })}
            {status && <span className={`${player.timed ? 'ms-4 ' : ''}${player.error ? 'text-rose-300' : 'text-amber-300'}`}>{status}</span>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={player.previous} className={controlClass} title={t('Previous Surah')}>
              <ChevronLeft className="w-7 h-7 rtl:rotate-180" />
            </button>
            <button
              onClick={player.toggle}
              className="p-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 cursor-pointer"
              title={t(player.playing ? 'Pause' : 'Play')}
            >
              {player.playing ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7" />}
            </button>
            <button onClick={player.next} className={controlClass} title={t('Next Surah')}>
              <ChevronRight className="w-7 h-7 rtl:rotate-180" />
            </button>
            <button onClick={onChoose} className="px-5 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-[20px] font-semibold cursor-pointer">
              {t('Choose Surah')}
            </button>
            <button onClick={player.stop} className={controlClass} title={t('Stop and show Hadiths')}>
              <Square className="w-7 h-7" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface QuranDialogProps {
  player: QuranPlayer;
  i18n: I18n;
  onClose: () => void;
  /** A surah was picked and is starting */
  onPlay: () => void;
  onStop: () => void;
  /** On a phone (zoomed to its width): fewer surahs a row, and the buttons wrap */
  phone?: boolean;
}

/** Remote-friendly picker: reciter, "continue to the next surah", and the 114 surahs. */
export const QuranDialog: React.FC<QuranDialogProps> = ({ player, i18n, onClose, onPlay, onStop, phone }) => {
  const { t } = i18n;
  const currentRef = useRef<HTMLButtonElement>(null);
  const { settings } = player;

  useEffect(() => {
    currentRef.current?.focus();
    currentRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  // Where the last recitation of the current surah stopped (e.g. before the app was closed)
  const savedPosition = getQuranPosition();
  const saved = savedPosition?.surah === settings.surah && savedPosition.time > 10 ? savedPosition : null;
  const reciterRowRef = useRef<HTMLDivElement>(null);
  const reciterIndex = Math.max(0, RECITERS.findIndex((r) => r.id === settings.reciter));
  const chooseReciter = (index: number) => {
    player.updateSettings({ reciter: RECITERS[(index + RECITERS.length) % RECITERS.length].id });
  };

  // Keep the chosen reciter in view in the scrolling row
  useEffect(() => {
    reciterRowRef.current
      ?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [settings.reciter]);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center px-[96px] py-[54px] bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-[1500px] max-h-full flex flex-col rounded-[36px] bg-[var(--tv-dialog)] border border-amber-500/30 p-10 shadow-2xl">
        <div className="flex items-center justify-between gap-6 pb-6 mb-6 border-b border-white/10">
          <div>
            <h3 className="font-serif text-[48px] leading-tight font-bold text-white">{t('Quran Recitation')}</h3>
            <p className="text-[22px] text-neutral-400">{t('Choose a surah to start. It pauses by itself for the Adhan.')}</p>
          </div>
          <button onClick={onClose} className="p-4 rounded-2xl bg-white/10 hover:bg-white/20 text-neutral-200 cursor-pointer" title={t('Close')}>
            <X className="w-8 h-8" />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <span className="shrink-0 text-[24px] text-neutral-400">{t('Reciter')}</span>
          <button
            onClick={() => chooseReciter(reciterIndex - 1)}
            className="shrink-0 p-4 rounded-2xl bg-white/10 hover:bg-white/20 text-neutral-200 cursor-pointer"
            title={t('Previous reciter')}
          >
            <ChevronLeft className="w-8 h-8 rtl:rotate-180" />
          </button>
          <div ref={reciterRowRef} className="flex-1 min-w-0 flex gap-3 overflow-x-auto scroll-smooth p-2 [scrollbar-width:thin]">
            {RECITERS.map((r, i) => {
              const selected = i === reciterIndex;
              return (
                <button
                  key={r.id}
                  onClick={() => chooseReciter(i)}
                  aria-pressed={selected}
                  className={`shrink-0 px-6 py-4 rounded-3xl text-[24px] font-semibold whitespace-nowrap cursor-pointer border ${
                    selected ? 'bg-amber-500 text-neutral-950 border-amber-400' : 'bg-white/5 hover:bg-white/15 text-white border-white/10'
                  }`}
                >
                  {i18n.isArabic ? r.nameAr : r.name}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => chooseReciter(reciterIndex + 1)}
            className="shrink-0 p-4 rounded-2xl bg-white/10 hover:bg-white/20 text-neutral-200 cursor-pointer"
            title={t('Next reciter')}
          >
            <ChevronRight className="w-8 h-8 rtl:rotate-180" />
          </button>
        </div>

        <div className={`flex items-center gap-4 mb-6 ${phone ? 'flex-wrap' : ''}`}>
          <button
            onClick={() => player.updateSettings({ continuous: !settings.continuous })}
            aria-pressed={settings.continuous}
            className={`flex items-center gap-3 px-7 py-5 rounded-3xl text-[24px] font-semibold cursor-pointer ${
              settings.continuous ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-white/5 text-neutral-300 border border-white/10'
            }`}
          >
            <Repeat className="w-7 h-7" />
            <span>{t(settings.continuous ? 'Continue to the next surah' : 'Stop after this surah')}</span>
          </button>
          {/* Always shown, greyed out (and skipped by the remote) for a reciter it can't follow */}
          {(() => {
            const available = canAddEnglish(settings.reciter);
            const on = available && settings.englishAfterVerse;
            const label = available
              ? on ? t('English translation after each verse') : t('No English translation')
              : isEnglishReciter(settings.reciter) ? t('Already includes English') : t('English translation not available for this reciter');
            return (
              <button
                onClick={() => player.updateSettings({ englishAfterVerse: !settings.englishAfterVerse })}
                disabled={!available}
                aria-pressed={on}
                className={`flex items-center gap-3 px-7 py-5 rounded-3xl text-[24px] font-semibold whitespace-nowrap ${
                  !available
                    ? 'bg-white/5 text-neutral-500 border border-white/5 opacity-60 cursor-not-allowed'
                    : on ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-pointer' : 'bg-white/5 text-neutral-300 border border-white/10 cursor-pointer'
                }`}
              >
                <Languages className="w-7 h-7" />
                <span>{label}</span>
              </button>
            );
          })()}
          {!player.active && saved && (
            <button
              onClick={() => {
                player.resume();
                onPlay();
              }}
              className="flex items-center gap-3 px-7 py-5 rounded-3xl bg-amber-500/20 text-amber-200 border border-amber-500/40 text-[24px] font-semibold cursor-pointer whitespace-nowrap"
            >
              <Play className="w-6 h-6" />
              <span>
                {hasVerseTimings(saved.reciter)
                  ? t('Continue {surah} from verse {n}', {
                      surah: i18n.isArabic ? SURAHS[saved.surah - 1].ar : SURAHS[saved.surah - 1].en,
                      n: saved.verse
                    })
                  : t('Continue {surah} from {time}', {
                      surah: i18n.isArabic ? SURAHS[saved.surah - 1].ar : SURAHS[saved.surah - 1].en,
                      time: formatDuration(saved.time)
                    })}
              </span>
            </button>
          )}
          {player.active && (
            <button
              onClick={onStop}
              className="flex items-center gap-3 px-7 py-5 rounded-3xl bg-rose-500/20 text-rose-200 border border-rose-500/40 text-[24px] font-semibold cursor-pointer"
            >
              <Square className="w-6 h-6" />
              <span>{t('Stop')}</span>
            </button>
          )}
        </div>

        <div className={`grid ${phone ? 'grid-cols-3' : 'grid-cols-6'} gap-3 overflow-y-auto p-2`}>
          {SURAHS.map((s) => {
            const selected = s.n === settings.surah;
            return (
              <button
                key={s.n}
                ref={selected ? currentRef : undefined}
                onClick={() => {
                  player.play(s.n);
                  onPlay();
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-start cursor-pointer border ${
                  selected ? 'bg-amber-500 text-neutral-950 border-amber-400' : 'bg-white/5 hover:bg-white/15 text-white border-white/10'
                }`}
              >
                <span className={`shrink-0 w-11 text-[20px] font-mono font-bold ${selected ? 'text-neutral-900' : 'text-amber-400'}`}>{s.n}</span>
                <span className="min-w-0">
                  <span className="block font-arabic text-[26px] leading-tight">{s.ar}</span>
                  {!i18n.isArabic && <span className={`block text-[16px] truncate ${selected ? 'text-neutral-800' : 'text-neutral-400'}`}>{s.en}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
