# Islamic TV App — Daily Hadith & Azan for Google TV

A full-screen mosque display for **Google TV** and any big-screen browser: **Automatic Azan & Prayer Times** synchronized with **[Awqat.com.au](https://www.awqat.com.au/)** and mosques' own timetables, the **Iqamah countdown**, **Quran recitation**, and a **Daily Hadith from every collection on [sunnah.com](https://sunnah.com/)** (50,884 Hadiths).

The app is built from `index.html` → `src/tv/`, with the prayer-time & Azan engine, components and data in `src/shared/`. It was split out of the [Daily Hadith & Azan](https://github.com/IsamicApps/Azan) project, which is now the phone app only. The old TV address, isamicapps.github.io/Azan/tv/, redirects here. The first time a TV is redirected, its settings come with it in the link (`#import=…`, read by `src/tv/importSettings.ts`): the mosque, Azan voices, theme, Quran position and so on.

---

## 🌟 Features

### 📺 On the TV
- **Remote-control (D-pad) navigation**: arrows move focus, OK selects, Back closes dialogs; Channel +/− browses Hadiths.
- **"Press OK to Start" screen** — the one remote press lets the TV play the Azan automatically afterwards.
- **Mosque picker**, full-screen landscape layout, live next-prayer countdown and Iqamah times.
- **Iqamah countdown and "prayer in progress"**: between the Adhan and the Iqamah a full-screen countdown is shown, then the screen dims while the prayer is on.
- **Hadith slide speed**: each Hadith stays 10 sec, 15 sec, 25 sec (default), 45 sec, 1 min, 2 min or 5 min, or the slides can be paused (footer button or **S** key).
- **Iqamah**: when the Iqamah countdown ends, the TV plays the Iqamah of Masjid al-Haram, Makkah (`public/audio/iqamah_makkah.mp3`, from [this recording](https://www.youtube.com/shorts/WyK1Rf0AiZQ)). Once per prayer, only at the moment itself, and silent with Auto-Azan muted. In the Azan Voices dialog it can be turned off for all prayers or one by one ("Iqamah on/off" on each prayer), or listened to.
- **Du'a after the Azan**: when the Azan finishes, the popup turns to the Du'a and plays it as recited at Masjid al-Haram, Makkah (`public/audio/dua_makkah.mp3`, from [this recording](https://www.youtube.com/watch?v=4VQ8TKhopEU), without its opening "Allahu Akbar"). When it ends, the popup closes and the Iqamah countdown shows; after the prayer the screen and the Quran carry on from where they were. In the Azan Voices dialog the recitation can be changed or listened to: Masjid al-Haram (default), Masjid an-Nabawi (muezzin Mahdi Barri, [recording](https://www.youtube.com/watch?v=ZtoiaPFsH_o)), Mishary Rashid Alafasy ([recording](https://www.youtube.com/watch?v=-N33WY2514o)) or Saad Al-Qureshi ([recording](https://www.youtube.com/watch?v=v_PcHtpYDUs)), each cut to the Du'a alone (`public/audio/dua_*.mp3`).
- **Screen brightness**: dim the whole screen to 85%, 70%, 55%, 40% or 25% (footer button or **B** key).
- **Quran recitation** (Quran button or **Q** key): any of the 114 surahs from 12 reciters (pick one from the scrolling reciter row) through the [Quran Foundation](https://api-docs.quran.foundation) Quran.com API. The verse being recited is shown in Uthmani script, with the Saheeh International translation when the Hadith language is English. Plays on to the next surah (optional), pauses by itself for the Adhan, the Iqamah and the prayer, and carries on by itself from the same place once the prayer is over (on Friday it stays paused after the Dhuhr Azan for Jumu'ah, until Play is pressed). Always carries on from where it stopped: after a pause, the prayer, the TV hiding the app, or a dropped connection; after the app is closed, the Quran dialog offers "Continue … from verse N". Remote: Play/Pause, Channel +/− for the next/previous surah, Back to stop.
- **Screen and Hadith languages separately** (language button or **L** key): English or العربية for the screen (menus, prayer times, dates, right-to-left layout) and for the Hadith text independently. Strings live in `src/shared/i18n.ar.ts`, keyed by their English text.
- **Wake Lock & OLED micro-drift** so the screen stays on without burn-in.

### 🎨 Themes (theme button or **T** key)
Defined in `src/shared/theme.ts`:
- **Time of Day**: the background follows the selected mosque's prayer times: dawn blues from Fajr, teal by day, gold from Asr, plum from Maghrib and night after Isha, fading between them. Suits a screen left on all day.
- **Day & Night**: light Parchment from sunrise until Maghrib, Obsidian at night.
- **Obsidian, Emerald, Sapphire, Royal Gold** (dark) and **Parchment** (light).
- **Ramadan**: a crescent and lantern appear in the header during Ramadan, and the time-based themes use a deeper indigo at night.

### 🕌 Azan & prayer times
- **Same times as Awqat**: for the mosques on [awqat.com.au](https://www.awqat.com.au/), Adhan times, Iqamah, Jumu'ah and the Hijri date follow each mosque's Awqat page. Daylight saving is applied automatically. Mosques not on Awqat use the built-in calculation.
- **Mosques' own timetables**: Preston Mosque (Islamic Society of Victoria, [isv.org.au](https://isv.org.au/)) uses the yearly Adhan and Iqamah timetable it publishes on its website (The Masjid App widget); add another Masjid App mosque in `scripts/sync-mosque-timetables.mjs`.
- **Daily sync**: `.github/workflows/sync-prayer-times.yml` re-downloads both every day (`npm run awqat:data`, `npm run mosques:data`), and when anything changed tests, commits, builds and deploys to the `gh-pages` branch.
- **Azan recordings**: Makkah, Madinah, Mishary Rashid Alafasy, Masjid Al-Aqsa, Sheikh Abdul Basit, and a gentle chime (`public/audio/`).

### 📖 Daily Hadith
- **All 17 sunnah.com collections**, in a shuffled order of the whole library so every Hadith appears once before any repeats.
- **Grades** (Sahih, Hasan…) from [hadith-api](https://github.com/fawazahmed0/hadith-api); only Sahih, Hasan and ungraded Hadiths are shown.
- **Data**: built by `npm run hadith:data` from [hadith-json](https://github.com/AhmedBaset/hadith-json) into `public/hadith/v3/` — an index plus 100-Hadith chunks. The bundled Bukhari pool is the offline fallback.

---

## 📺 Android TV app

`android/` is a small Android app that shows the TV page full screen. Compared with opening the page in a browser:
- **Opens when the TV turns on**, and goes straight to the prayer times (no "Press OK to Start"), so the Azan plays on time after a power cut.
- **Sound plays without a key press**, the screen stays on, and the page keeps running when another app is in front.
- **Appears in the TV's app list** with its own banner. Back on the remote closes dialogs and the Quran first.
- If the internet isn't up yet, it shows "Waiting for the internet…" and tries again every 30 seconds.

It shows the live site, so changes to the web app reach every TV without a new APK: each build writes `version.json`, and a TV running the app checks it every 15 minutes and reloads itself at a quiet moment (no Azan, Iqamah, prayer, Quran or open menu). `.github/workflows/android.yml` builds a new APK only when `android/` changes, signs it with the release key (repo secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`), and publishes it as the latest release.

**Install on Google TV / Android TV**
1. On the TV, install **Downloader** (by AFTVnews) from the Play Store.
2. Settings → System → About → press **Android TV OS build** 7 times to turn on developer options. Then Settings → Apps → Security & restrictions → **Unknown sources** → allow **Downloader**.
3. In Downloader, open `https://github.com/IslamicApplications/IslamicTvApps/releases/latest/download/DailyHadithAzan-TV.apk` and install.
4. To open it automatically when the TV turns on: Settings → Apps → Special app access → **Display over other apps** → allow **Daily Hadith & Azan** (Android 10 and later need this to open an app at start-up).

The menu names differ a little between TV makes.

**Google Play**: `play-store/README.md` has the step-by-step guide, the store listing text (English and Arabic), the answers for the Play Console forms, the graphics and screenshots. The privacy policy is at https://islamicapplications.github.io/IslamicTvApps/privacy.html.

## 🚀 Getting Started

```bash
git clone https://github.com/IslamicApplications/IslamicTvApps.git
cd IslamicTvApps
npm install

# Development server: http://localhost:5173/
npm run dev

# Build for production (into dist/)
npm run build
```

## Tests

`npm test` checks prayer times for every mosque over a year, the match with Awqat, daylight saving, the Hijri calendar, the Arabic interface and the daily Hadith order. It also checks the TV's own features (`tests/tvFeatures.test.ts`): the Iqamah countdown and prayer screen, when the Iqamah sound plays (live only, once, muted or off), carrying the Quran on from where it stopped, and the settings import. `.github/workflows/test.yml` runs them on every push.

## 🛠️ Tech Stack
- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS v4**
- **Lucide Icons**

## 📜 License
MIT License. Content sourced from authentic public Islamic datasets.
