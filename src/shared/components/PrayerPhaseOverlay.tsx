import React, { useEffect } from 'react';
import { PrayerTimesResult } from '../utils/prayerTimes';
import { IqamaPrayer } from '../utils/awqat';
import { I18n } from '../i18n';
import { AzanSettings } from '../utils/azanAudio';
import { BACK_PRIORITY, useBackHandler } from '../hooks/useBackHandler';

const PRAYERS: IqamaPrayer[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

/** How long each prayer takes after the Iqamah (the defaults of Awqat's mosque displays). */
const PRAYER_MINUTES: Record<IqamaPrayer, number> = { Fajr: 12, Dhuhr: 7, Asr: 7, Maghrib: 10, Isha: 15 };

export type PrayerPhase =
  | { kind: 'countdown'; prayer: IqamaPrayer; secondsLeft: number; key: string }
  | { kind: 'praying'; prayer: IqamaPrayer; key: string };

/**
 * Between a prayer's Adhan and its Iqamah: a countdown. From the Iqamah until the
 * prayer is over: "prayer in progress" with the screen dimmed. Null otherwise.
 * `minutesNow` is the mosque's local time in minutes after midnight (with seconds).
 */
export function getPrayerPhase(prayerData: PrayerTimesResult, minutesNow: number, skip?: (prayer: IqamaPrayer) => boolean): PrayerPhase | null {
  for (const prayer of PRAYERS) {
    if (skip?.(prayer)) continue;
    const adhan = prayerData.adhanMinutes[prayer];
    const iqama = prayerData.iqamaMinutes[prayer];
    if (iqama === undefined || iqama <= adhan) continue;
    if (minutesNow >= adhan && minutesNow < iqama) {
      return { kind: 'countdown', prayer, secondsLeft: Math.ceil((iqama - minutesNow) * 60), key: `${prayerData.localDateKey}-${prayer}-countdown` };
    }
    if (minutesNow >= iqama && minutesNow < iqama + PRAYER_MINUTES[prayer]) {
      return { kind: 'praying', prayer, key: `${prayerData.localDateKey}-${prayer}-praying` };
    }
  }
  return null;
}

/**
 * Whether the Iqamah should play now: in the first minute after the Iqamah time (only
 * live, not when the TV is switched on later in the prayer), unless Auto-Azan is muted or
 * the Iqamah is turned off, for all prayers or this one. Each prayer's Iqamah still plays
 * once (claimIqamahTrigger).
 */
export function shouldPlayIqamah(
  phase: PrayerPhase | null,
  prayerData: PrayerTimesResult,
  minutesNow: number,
  settings: Pick<AzanSettings, 'autoAzanEnabled' | 'iqamahSound' | 'iqamahPrayers'>
): boolean {
  if (phase?.kind !== 'praying' || !settings.autoAzanEnabled || settings.iqamahSound === false) return false;
  if (settings.iqamahPrayers?.[phase.prayer] === false) return false;
  const iqama = prayerData.iqamaMinutes[phase.prayer];
  return iqama !== undefined && minutesNow >= iqama && minutesNow - iqama <= 1;
}

/**
 * Whether the Quran, paused for a prayer, may carry on: the prayer it waited for
 * (`waitingFor`, "date-prayer") is over (its countdown and prayer time have passed) and no
 * Azan or Iqamah is playing. Without a prayer to wait for (paused for an Azan with no
 * Iqamah countdown, e.g. Jumu'ah on Friday) it stays paused until Play is pressed.
 */
export function quranMayContinue(waitingFor: string | null, currentPhaseKey: string | null, azanPlaying: boolean): boolean {
  return waitingFor !== null && currentPhaseKey !== waitingFor && !azanPlaying;
}

interface PrayerPhaseOverlayProps {
  phase: PrayerPhase;
  i18n: I18n;
  onDismiss: () => void;
}

/** Full-screen TV overlay for the Iqamah countdown and the prayer itself. Any key or tap hides it. */
export const PrayerPhaseOverlay: React.FC<PrayerPhaseOverlayProps> = ({ phase, i18n, onDismiss }) => {
  const { t } = i18n;

  // The remote's Back in the Android app (it never arrives as a key) hides it too
  useBackHandler(true, BACK_PRIORITY.prayerScreen, onDismiss);

  useEffect(() => {
    const hide = (e: KeyboardEvent) => {
      // The Azan popup sits on top at the Adhan: its buttons get the remote, not this overlay
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onDismiss();
    };
    // Capture phase: the key only hides the overlay, it doesn't also trigger the TV shortcuts
    window.addEventListener('keydown', hide, true);
    return () => window.removeEventListener('keydown', hide, true);
  }, [onDismiss]);

  if (phase.kind === 'praying') {
    return (
      <div
        onClick={onDismiss}
        className="fixed inset-0 z-[80] bg-black/95 flex flex-col items-center justify-center gap-6 text-neutral-500 cursor-pointer"
      >
        <div className="font-serif text-[64px] font-bold text-neutral-400">{t('{prayer} Prayer', { prayer: i18n.prayer(phase.prayer) })}</div>
        <div className="text-[36px]">{t('Prayer in progress')}</div>
        <div className="text-[22px] text-neutral-600">{t('Please silence your phone')}</div>
      </div>
    );
  }

  const minutes = Math.floor(phase.secondsLeft / 60);
  const seconds = String(phase.secondsLeft % 60).padStart(2, '0');
  const lastMinute = phase.secondsLeft <= 60;

  return (
    <div
      onClick={onDismiss}
      className="fixed inset-0 z-[80] bg-(--s0)/95 backdrop-blur-sm flex flex-col items-center justify-center gap-8 text-white cursor-pointer"
    >
      <div className="font-serif text-[72px] font-bold text-amber-300">{t('{prayer} Prayer', { prayer: i18n.prayer(phase.prayer) })}</div>
      <div className="text-[44px] text-neutral-300">{t('Iqamah in')}</div>
      <div dir="ltr" className={`font-mono font-extrabold leading-none ${lastMinute ? 'text-emerald-300 animate-pulse' : 'text-white'} text-[260px]`}>
        {minutes}:{seconds}
      </div>
      <div className="text-[36px] text-neutral-300">{t(lastMinute ? 'Please straighten the rows' : 'Please silence your phone')}</div>
      <div className="text-[22px] text-neutral-500">{t('Press any key to hide')}</div>
    </div>
  );
};
