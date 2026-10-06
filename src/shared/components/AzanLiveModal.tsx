import React, { useState, useEffect, useRef } from 'react';
import { IslamicPattern, IslamicCornerOrnament } from './IslamicPattern';
import { Mosque } from '../utils/prayerTimes';
import { Volume2, VolumeX, X, Sparkles, Building2, Bell, Play, Square } from 'lucide-react';
import { useI18n } from '../i18n';
import { stopAdhan, playDua } from '../utils/azanAudio';
import { BACK_PRIORITY, useBackHandler } from '../hooks/useBackHandler';

interface AzanLiveModalProps {
  isOpen: boolean;
  prayerName: string;
  prayerTime: string;
  mosque: Mosque;
  onClose: () => void;
  /** The browser blocked the Azan sound; show a button that plays it from a tap */
  soundBlocked?: boolean;
  onTapToPlay?: () => void;
  /** The Azan has finished: the popup turns to the Du'a, plays it, then closes */
  azanEnded?: boolean;
}

const duaAfterAdhanArabic = "اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ، وَالصَّلَاةِ الْقَائِمَةِ، آتِ مُحَمَّدًا الْوَسِيلَةَ وَالْفَضِيلَةَ، وَابْعَثْهُ مَقَامًا مَحْمُودًا الَّذِي وَعَدْتَهُ";
const duaTranslation = "O Allah, Lord of this perfect call and established prayer, grant Muhammad the status of intercession and nobility, and raise him to the praised position which You have promised him.";

/** If the Du'a recording can't play (e.g. offline), the Du'a stays this long to be read */
const DUA_READING_MS = 30_000;
/** A recording that ends sooner than this didn't really play */
const DUA_MIN_PLAY_MS = 5_000;
/** The popup closes after this long on the Du'a even if the recording never reports its end */
const DUA_MAX_MS = 90_000;

export const AzanLiveModal: React.FC<AzanLiveModalProps> = ({
  isOpen,
  prayerName,
  prayerTime,
  mosque,
  onClose,
  soundBlocked = false,
  onTapToPlay,
  azanEnded = false
}) => {
  const i18n = useI18n();
  const { t } = i18n;
  const [isRecitingDua, setIsRecitingDua] = useState(false);
  const recitingRef = useRef(false);
  // Set when the Stop Du'a button stops the recording, so the popup stays open
  const stoppedByUserRef = useRef(false);
  const readingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const showingDua = isOpen && azanEnded;

  const setReciting = (value: boolean) => {
    recitingRef.current = value;
    setIsRecitingDua(value);
  };

  // The Du'a of Masjid al-Haram; when it has played to the end, the popup closes and
  // the Iqamah countdown shows
  const reciteDua = () => {
    stoppedByUserRef.current = false;
    setReciting(true);
    const startedAt = Date.now();
    playDua(() => {
      setReciting(false);
      if (stoppedByUserRef.current) return;
      if (Date.now() - startedAt >= DUA_MIN_PLAY_MS) onCloseRef.current();
      else readingTimerRef.current = setTimeout(() => onCloseRef.current(), DUA_READING_MS);
    });
  };

  // The Azan has finished: the Du'a plays by itself
  useEffect(() => {
    if (!showingDua) return;
    reciteDua();
    const timer = setTimeout(() => onCloseRef.current(), DUA_MAX_MS);
    return () => clearTimeout(timer);
  }, [showingDua]);

  // The popup closed some other way: the Du'a doesn't carry on behind it
  useEffect(() => {
    if (isOpen) return;
    if (readingTimerRef.current) clearTimeout(readingTimerRef.current);
    readingTimerRef.current = null;
    stoppedByUserRef.current = true;
    if (recitingRef.current) stopAdhan();
    setReciting(false);
  }, [isOpen]);

  const handleStop = () => {
    stoppedByUserRef.current = true;
    stopAdhan();
    setReciting(false);
    onClose();
  };

  // The remote's Back dismisses the popup, like the Dismiss button
  useBackHandler(isOpen, BACK_PRIORITY.azanPopup, handleStop);

  if (!isOpen) return null;

  const handleToggleReciteDua = () => {
    if (isRecitingDua) {
      stoppedByUserRef.current = true;
      stopAdhan();
      setReciting(false);
    } else {
      reciteDua(); // takes over from the Azan if it is still playing
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-fade-in select-none">
      <div className="azan-live-modal relative w-full max-w-lg rounded-3xl bg-gradient-to-b from-(--s3) via-(--s2) to-(--s0) border border-amber-500/40 p-6 md:p-8 shadow-2xl overflow-hidden flex flex-col justify-between text-neutral-100 max-h-[var(--azan-modal-max-h,92vh)] overflow-y-auto">
        <IslamicPattern opacity={24} />
        <IslamicCornerOrnament className="absolute top-3 left-3 rotate-0 opacity-40" />
        <IslamicCornerOrnament className="absolute top-3 right-3 rotate-90 opacity-40" />
        <IslamicCornerOrnament className="absolute bottom-3 left-3 -rotate-90 opacity-40" />
        <IslamicCornerOrnament className="absolute bottom-3 right-3 rotate-180 opacity-40" />

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between pb-3 border-b border-amber-500/20">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-xs font-sans font-bold tracking-widest text-amber-300 uppercase">
              {showingDua ? t("Du'a after Azan") : t('Azan (Adhan) Now Playing')}
            </span>
          </div>

          <button
            onClick={handleStop}
            className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Center Animated Azan Calligraphy */}
        <div className="relative z-10 py-5 text-center space-y-4">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold">
            <Building2 className="w-3.5 h-3.5" />
            <span>{mosque.name} ({mosque.suburb}, {mosque.state})</span>
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest text-neutral-400 font-medium">{t('Time for')}</div>
            <h2 className="font-serif text-3xl md:text-5xl font-bold text-white tracking-wide mt-1">
              {t('{prayer} Prayer', { prayer: i18n.prayer(prayerName) })}
            </h2>
            <div className="text-sm font-mono text-amber-400 font-semibold mt-0.5">{i18n.time(prayerTime)}</div>
          </div>

          {/* Arabic Calligraphy Banner */}
          <div className="p-4 rounded-2xl bg-black/40 border border-amber-500/20">
            <p className="font-arabic text-2xl md:text-3xl text-amber-200 leading-loose">
              حَيَّ عَلَى الصَّلَاةِ • حَيَّ عَلَى الْفَلَاحِ
            </p>
            {!i18n.isArabic && (
              <p className="text-xs text-neutral-400 mt-1 italic font-serif">
                &ldquo;Hasten to Prayer • Hasten to Success&rdquo;
              </p>
            )}
          </div>

          {soundBlocked && onTapToPlay && (
            <button
              autoFocus
              onClick={onTapToPlay}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-sm shadow-lg animate-pulse cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{t('Tap to play the Azan')}</span>
            </button>
          )}

          {/* Animated Audio Equalizer Bars */}
          {!showingDua && <div className="flex items-center justify-center space-x-1.5 py-1">
            {[40, 75, 55, 90, 65, 80, 45, 95, 60, 85, 50].map((h, idx) => (
              <span
                key={idx}
                className="w-1.5 bg-gradient-to-t from-amber-500 to-amber-200 rounded-full animate-pulse"
                style={{
                  height: `${h * 0.35}px`,
                  animationDelay: `${idx * 120}ms`,
                  animationDuration: '900ms'
                }}
              />
            ))}
          </div>}

          {/* Du'a after Adhan with Recite Audio Button */}
          <div className={`p-4 rounded-2xl bg-neutral-900/80 border text-start space-y-2.5 ${showingDua ? 'border-amber-500/50' : 'border-white/10'}`}>
            <div className="flex items-center justify-between text-[11px] text-amber-400 font-semibold">
              <span>{t("Du'a after Azan (Bukhari #614)")}</span>
              <button
                onClick={handleToggleReciteDua}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                  isRecitingDua
                    ? 'bg-amber-500 text-neutral-950 font-bold animate-pulse'
                    : 'bg-white/10 hover:bg-white/20 text-neutral-200'
                }`}
                title={t("Listen to Du'a recitation")}
              >
                {isRecitingDua ? <Square className="w-3 h-3 fill-current" /> : <Volume2 className="w-3 h-3" />}
                <span>{t(isRecitingDua ? "Stop Du'a" : "Recite Du'a")}</span>
              </button>
            </div>
            <p dir="rtl" className={`font-arabic text-neutral-200 leading-relaxed text-right ${showingDua ? 'text-xl md:text-2xl' : 'text-sm'}`}>
              {duaAfterAdhanArabic}
            </p>
            {!i18n.isArabic && (
              <p className={`font-serif text-neutral-400 italic ${showingDua ? 'text-sm' : 'text-xs'}`}>
                &ldquo;{duaTranslation}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="relative z-10 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
          <div className="text-[11px] text-neutral-400">
            {t('Source')}: <a href="https://islamic.network/api/" target="_blank" rel="noopener noreferrer" className="underline text-amber-400">Islamic Network API</a> & <a href="https://www.awqat.com.au/" target="_blank" rel="noopener noreferrer" className="underline text-emerald-400">Awqat.com.au</a>
          </div>

          <button
            autoFocus={!soundBlocked}
            onClick={handleStop}
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg transition cursor-pointer"
          >
            {t('Dismiss Azan')}
          </button>
        </div>
      </div>
    </div>
  );
};
