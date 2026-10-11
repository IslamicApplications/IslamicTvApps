import React, { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { useI18n } from '../shared/i18n';
import { IN_ANDROID_APP } from '../shared/utils/androidApp';

/** The phone app (the Daily Hadith & Azan project this TV app was split from) */
export const PHONE_APP_URL = 'https://isamicapps.github.io/Azan/';

const DISMISSED_KEY = 'daily_hadith_tv_phone_note_dismissed';

/**
 * A phone: a touch screen whose shorter side is under 500 CSS px. A TV has no touch
 * screen (and reports 540 px or more), a tablet's shorter side is 744 px or more.
 */
export function isPhoneScreen(width: number, height: number, touch: boolean): boolean {
  return touch && Math.min(width, height) < 500;
}

function detectPhone(): boolean {
  if (IN_ANDROID_APP || typeof window === 'undefined') return false;
  const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return isPhoneScreen(window.innerWidth, window.innerHeight, touch);
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * On a phone the TV screen is shrunk to a third of its size: points to the phone app.
 * Drawn outside the TV stage, so it is phone-sized; "Continue anyway" hides it for good.
 */
export const PhoneNote: React.FC = () => {
  const { t } = useI18n();
  const [shown, setShown] = useState(() => detectPhone() && !wasDismissed());

  // Turning the phone round doesn't make it a TV, but a resized desktop window may stop being "a phone"
  useEffect(() => {
    if (!shown) return;
    const update = () => setShown(detectPhone() && !wasDismissed());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [shown]);

  if (!shown) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {}
    setShown(false);
  };

  return (
    // Not role="dialog": the remote's arrows keep to the topmost dialog (useSpatialNavigation)
    <aside aria-label={t('On a phone?')} className="fixed inset-x-0 bottom-0 z-[200] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-md rounded-2xl bg-neutral-900/95 border border-amber-500/40 shadow-2xl p-4 text-white">
        <div className="flex items-start gap-3">
          <Smartphone className="w-6 h-6 shrink-0 text-amber-400 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-base">{t('On a phone?')}</div>
            <p className="text-sm text-neutral-300 mt-1">{t('This screen is made for TVs. The Daily Hadith & Azan phone app is easier to use on a phone.')}</p>
          </div>
          <button onClick={dismiss} className="p-1 -m-1 text-neutral-400 hover:text-white cursor-pointer" title={t('Close')} aria-label={t('Close')}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <a href={PHONE_APP_URL} className="flex-1 text-center rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-sm py-2.5">
            {t('Open the phone app')}
          </a>
          <button onClick={dismiss} className="flex-1 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm py-2.5 cursor-pointer">
            {t('Continue anyway')}
          </button>
        </div>
      </div>
    </aside>
  );
};
