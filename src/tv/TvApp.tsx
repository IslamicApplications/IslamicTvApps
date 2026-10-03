import React, { useState, useEffect, useRef } from 'react';
import { SmartTvDisplayView } from '../shared/components/SmartTvDisplayView';
import { AutoAzanHost } from '../shared/components/AutoAzanHost';
import { AppLogo } from '../shared/components/AppLogo';
import { unlockAudio } from '../shared/utils/azanAudio';
import { useSpatialNavigation } from './useSpatialNavigation';
import { TvStage } from './TvStage';
import { loadDailyHadithOrBundled } from '../shared/utils/hadithLibrary';
import { useDocumentLanguage, useI18n } from '../shared/i18n';

export function TvApp() {
  const [hasStarted, setHasStarted] = useState(false);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  useSpatialNavigation();
  useDocumentLanguage();
  const { t } = useI18n();

  useEffect(() => {
    if (!hasStarted) startButtonRef.current?.focus();
  }, [hasStarted]);

  // Download today's Hadith while the start screen is showing
  useEffect(() => {
    loadDailyHadithOrBundled(new Date());
  }, []);

  // The remote's OK press is the user gesture browsers require before
  // the Azan may play automatically and before fullscreen is allowed.
  const handleStart = () => {
    unlockAudio();
    document.documentElement.requestFullscreen?.().catch(() => {});
    setHasStarted(true);
  };

  return (
    <TvStage>
      {hasStarted ? (
        <>
          <SmartTvDisplayView />
          <AutoAzanHost />
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
