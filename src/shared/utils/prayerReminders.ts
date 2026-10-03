import { Mosque, PrayerTimesResult } from './prayerTimes';
import { IqamaPrayer } from './awqat';
import { showNotification } from './notify';
import { currentI18n } from '../i18n';

/** Notifications before each prayer: N minutes before the Adhan, and optionally 5 before the Iqamah. */
export interface PrayerReminderSettings {
  /** Minutes before the Adhan; 0 = off */
  minutesBefore: 0 | 5 | 10 | 15 | 30;
  prayers: Record<IqamaPrayer, boolean>;
  beforeIqamah: boolean;
  /** Ramadan: minutes before Fajr to wake for Suhoor (0 = off) */
  suhoorMinutes: 0 | 30 | 45 | 60 | 90;
  /** Ramadan: notify at Maghrib for Iftar */
  iftar: boolean;
}

export const REMINDER_PRAYERS: IqamaPrayer[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const SETTINGS_KEY = 'daily_hadith_prayer_reminders';
const SENT_KEY = 'daily_hadith_prayer_reminders_sent';
export const REMINDER_SETTINGS_EVENT = 'prayer-reminders-change';

const DEFAULTS: PrayerReminderSettings = {
  minutesBefore: 0,
  prayers: { Fajr: true, Dhuhr: true, Asr: true, Maghrib: true, Isha: true },
  beforeIqamah: false,
  suhoorMinutes: 0,
  iftar: false
};

export function getReminderSettings(): PrayerReminderSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (saved) return { ...DEFAULTS, ...saved, prayers: { ...DEFAULTS.prayers, ...saved.prayers } };
  } catch {}
  return DEFAULTS;
}

export function saveReminderSettings(settings: PrayerReminderSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
  window.dispatchEvent(new Event(REMINDER_SETTINGS_EVENT));
}

/** Once per reminder, even with the app open in several tabs */
function claim(key: string): boolean {
  try {
    const sent: string[] = JSON.parse(localStorage.getItem(SENT_KEY) || '[]');
    if (sent.includes(key)) return false;
    localStorage.setItem(SENT_KEY, JSON.stringify([...sent.slice(-20), key]));
  } catch {}
  return true;
}

/** Called every second by the app-wide watcher; sends any reminder that is due this minute. */
export function checkPrayerReminders(result: PrayerTimesResult, mosque: Mosque): void {
  const settings = getReminderSettings();
  if (!settings.minutesBefore && !settings.beforeIqamah && !(result.isRamadan && (settings.suhoorMinutes || settings.iftar))) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const [h, m] = result.localTime24.split(':').map(Number);
  const now = h * 60 + m;
  const i18n = currentI18n();

  if (result.isRamadan) {
    if (settings.suhoorMinutes && now === result.adhanMinutes.Fajr - settings.suhoorMinutes && claim(`${result.localDateKey}-suhoor`)) {
      showNotification(i18n.t('Suhoor: {n} minutes until Fajr', { n: settings.suhoorMinutes }), {
        body: i18n.t('Suhoor ends at {time} ({mosque})', { time: i18n.time(result.fajr), mosque: mosque.name })
      });
    }
    if (settings.iftar && now === result.adhanMinutes.Maghrib && claim(`${result.localDateKey}-iftar`)) {
      showNotification(i18n.t('Iftar time'), {
        body: `${i18n.t('Maghrib {time}', { time: i18n.time(result.maghrib) })} • ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الأَجْرُ إِنْ شَاءَ اللَّهُ`
      });
    }
  }

  for (const prayer of REMINDER_PRAYERS) {
    if (!settings.prayers[prayer]) continue;
    const isJumuah = result.isFriday && prayer === 'Dhuhr';
    const name = i18n.prayer(isJumuah ? "Jumu'ah" : prayer);
    const adhan = result.adhanMinutes[prayer];
    const iqama = result.iqamaMinutes[prayer];

    if (settings.minutesBefore && now === adhan - settings.minutesBefore && claim(`${result.localDateKey}-${prayer}-adhan`)) {
      showNotification(i18n.t('{prayer} in {n} minutes', { prayer: name, n: settings.minutesBefore }), {
        body: i18n.t('Adhan {adhan}{iqama} at {mosque}', {
          adhan: i18n.time(prayerTime(result, prayer)),
          iqama: result.iqama[prayer] && !isJumuah ? ` • ${i18n.t('Iqamah')} ${i18n.time(result.iqama[prayer]!)}` : '',
          mosque: mosque.name
        })
      });
    }
    if (settings.beforeIqamah && iqama !== undefined && !isJumuah && now === iqama - 5 && iqama - 5 > adhan && claim(`${result.localDateKey}-${prayer}-iqamah`)) {
      showNotification(i18n.t('{prayer} Iqamah in 5 minutes', { prayer: name }), {
        body: i18n.t('Iqamah {time} at {mosque}', { time: i18n.time(result.iqama[prayer]!), mosque: mosque.name })
      });
    }
  }
}

function prayerTime(result: PrayerTimesResult, prayer: IqamaPrayer): string {
  return { Fajr: result.fajr, Dhuhr: result.dhuhr, Asr: result.asr, Maghrib: result.maghrib, Isha: result.isha }[prayer];
}
