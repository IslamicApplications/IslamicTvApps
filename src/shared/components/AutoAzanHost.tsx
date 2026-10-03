import React, { useState, useEffect } from 'react';
import {
  Mosque,
  calculateMosquePrayerTimes,
  getSelectedMosque,
  getDuePrayer,
  MOSQUE_CHANGE_EVENT
} from '../utils/prayerTimes';
import {
  MuezzinId,
  playAzan,
  stopAdhan,
  getAzanSettings,
  getMuezzinForPrayer,
  claimAzanTrigger,
  unlockAudioOnFirstInteraction
} from '../utils/azanAudio';
import { showNotification } from '../utils/notify';
import { currentI18n } from '../i18n';
import { checkPrayerReminders } from '../utils/prayerReminders';
import { AzanLiveModal } from './AzanLiveModal';

/**
 * The app-wide auto-Azan watcher. Render exactly one per app: it plays the Azan
 * when a prayer time arrives at the selected mosque and shows the live Azan modal.
 */
export const AutoAzanHost: React.FC = () => {
  const [selectedMosque, setSelectedMosque] = useState<Mosque>(getSelectedMosque());
  const [activePrayer, setActivePrayer] = useState<{ name: string; time: string; muezzin: MuezzinId } | null>(null);
  // The browser refused to start the Azan because the page hasn't been tapped since it loaded
  const [soundBlocked, setSoundBlocked] = useState(false);

  // Any tap or key press unlocks sound so the automatic Azan is allowed to play later
  useEffect(() => {
    unlockAudioOnFirstInteraction();
  }, []);

  // Follow whichever mosque was last selected anywhere in the app
  useEffect(() => {
    const syncMosque = () => setSelectedMosque(getSelectedMosque());
    window.addEventListener(MOSQUE_CHANGE_EVENT, syncMosque);
    return () => window.removeEventListener(MOSQUE_CHANGE_EVENT, syncMosque);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const result = calculateMosquePrayerTimes(selectedMosque, new Date());
      checkPrayerReminders(result, selectedMosque);
      const azanSettings = getAzanSettings();
      const duePrayer = azanSettings.autoAzanEnabled ? getDuePrayer(result) : null;
      if (!duePrayer || !claimAzanTrigger(`${result.localDateKey}_${duePrayer.name}`)) return;

      const muezzin = getMuezzinForPrayer(azanSettings, duePrayer.name);
      setActivePrayer({ ...duePrayer, muezzin });
      setSoundBlocked(false);
      playAzan(undefined, () => {}, muezzin, () => setSoundBlocked(true));

      const i18n = currentI18n();
      showNotification(i18n.t('Allahu Akbar • Time for {prayer} Prayer', { prayer: i18n.prayer(duePrayer.name) }), {
        body: i18n.t('Prayer time has arrived at {mosque} ({suburb}).', { mosque: selectedMosque.name, suburb: selectedMosque.suburb }),
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23d4af37"/></svg>'
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedMosque]);

  return (
    <AzanLiveModal
      isOpen={activePrayer !== null}
      prayerName={activePrayer?.name ?? ''}
      prayerTime={activePrayer?.time ?? ''}
      mosque={selectedMosque}
      soundBlocked={soundBlocked}
      onTapToPlay={() => {
        // Runs inside the tap, so the browser now allows the chosen voice to play
        if (!activePrayer) return;
        setSoundBlocked(false);
        playAzan(undefined, () => {}, activePrayer.muezzin, () => setSoundBlocked(true));
      }}
      onClose={() => {
        setActivePrayer(null);
        setSoundBlocked(false);
        stopAdhan();
      }}
    />
  );
};
