import React, { useState, useEffect, useRef } from 'react';
import { SmartTvDisplayView } from '../shared/components/SmartTvDisplayView';
import { AutoAzanHost } from '../shared/components/AutoAzanHost';
import { AppLogo } from '../shared/components/AppLogo';
import { unlockAudio } from '../shared/utils/azanAudio';
import { useSpatialNavigation } from './useSpatialNavigation';
import { TvStage } from './TvStage';
import { phoneMenuZoom, usePhone } from './phone';
import { loadDailyHadithOrBundled } from '../shared/utils/hadithLibrary';
import { useDocumentLanguage, useI18n } from '../shared/i18n';
// The Android app allows sound without a key press
import { IN_ANDROID_APP } from '../shared/utils/androidApp';
import { useLeaveHint } from '../shared/hooks/useBackHandler';


export function TvApp() {
  // In the Android app there's nothing to unlock: straight to the display (also after the TV turns on)
  const [hasStarted, setHasStarted] = useState(IN_ANDROID_APP);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  useSpatialNavigation();
  useDocumentLanguage();
  const { t } = useI18n();
  const leaveHint = useLeaveHint();
  // A phone gets its own layout at the phone's own size, instead of the TV screen shrunk to a third
  const { phone, width } = usePhone();

  useEffect(() => {
    if (!hasStarted) startButtonRef.current?.focus();
  }, [hasStarted]);

  // Download today's Hadith while the start screen is showing
  useEffect(() => {
    loadDailyHadithOrBundled(new Date());
    if (IN_ANDROID_APP) unlockAudio();
  }, []);

  // The remote's OK press is the user gesture browsers require before
  // the Azan may play automatically and before fullscreen is allowed.
  const handleStart = () => {
    unlockAudio();
    // (Not on a phone: there the browser's own bars are part of using it)
    if (!phone) document.documentElement.requestFullscreen?.().catch(() => {});
    setHasStarted(true);
  };

  if (phone) {
    return hasStarted ? (
      <>
        <SmartTvDisplayView phoneMenuZoom={phoneMenuZoom(width)} />
        <AutoAzanHost />
      </>
    ) : (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 px-6 bg-[#06080e] text-white text-center">
        <AppLogo size={96} glow={true} />
        <div className="space-y-2">
          <h1 className="font-serif text-3xl leading-tight font-bold">{t('Daily Hadith & Azan')}</h1>
          <p className="text-base text-neutral-400">{t('Prayer times, live Azan and Hadith from sunnah.com')}</p>
        </div>
        <button
          onClick={handleStart}
          className="w-full max-w-xs px-8 py-4 rounded-2xl bg-amber-500 active:bg-amber-400 text-neutral-950 text-lg font-bold shadow-xl shadow-amber-500/30 cursor-pointer"
        >
          {t('Tap to Start')}
        </button>
        <p className="text-sm text-neutral-500">{t('Starting enables the automatic Azan sound')}</p>
      </div>
    );
  }

  return (
    <TvStage>
      {hasStarted ? (
        <>
          <SmartTvDisplayView />
          <AutoAzanHost />
          {/* The Android app's first Back on the prayer times (a second one leaves) */}
          {leaveHint && (
            <div role="status" className="fixed bottom-24 inset-x-0 z-[90] flex justify-center pointer-events-none">
              <div className="px-10 py-5 rounded-full bg-neutral-900/95 border border-amber-500/50 text-[30px] font-semibold text-white shadow-2xl">
                {t('Press Back again to leave')}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#06080e] text-white gap-10">
          <AppLogo size={180} glow={true} />
          <div className="text-center space-y-4">
            <h1 className="font-serif text-[80px] leading-tight font-bold">{t('Daily Hadith & Azan')}</h1>
            <p className="text-[32px] text-neutral-400">{t('Prayer times, live Azan and Hadith from sunnah.com for your TV')}</p>
          </div>
          <button
            ref={startButtonRef}
            onClick={handleStart}
            className="px-16 py-7 rounded-[32px] bg-amber-500 hover:bg-amber-400 text-neutral-950 text-[40px] font-bold shadow-2xl shadow-amber-500/30 cursor-pointer"
          >
            {t('Press OK to Start')}
          </button>
          <p className="text-[24px] text-neutral-500">{t('Starting enables the automatic Azan sound on this TV')}</p>
        </div>
      )}
    </TvStage>
  );
}

export default TvApp;
