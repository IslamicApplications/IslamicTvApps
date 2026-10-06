# Publishing on Google Play (Google TV / Android TV)

Everything to upload is in this folder or produced by GitHub Actions. The steps that need you
(account, payment, identity, clicking through the Play Console) are marked **You**.

| What | Where |
| --- | --- |
| App bundle to upload | `DailyHadithAzan-TV.aab` on the [latest release](https://github.com/IslamicApplications/IslamicTvApps/releases/latest) (built by `.github/workflows/android.yml`) |
| App icon 512×512 | `graphics/icon-512.png` |
| Feature graphic 1024×500 | `graphics/feature-graphic-1024x500.png` |
| TV banner 1280×720 | `graphics/tv-banner-1280x720.png` |
| TV screenshots 1920×1080 (also usable as phone/tablet screenshots) | `screenshots/1…6` |
| Privacy policy URL | https://islamicapplications.github.io/IslamicTvApps/privacy.html |
| Signing key for Play | Actions → **Play signing key** workflow (step 3) |

---

## 1. Developer account — **You**

1. Go to https://play.google.com/console and sign up (one-time US$25, identity verification).
2. Account type:
   - **Organisation** (recommended for IslamicApplications or a mosque). Needs a free D-U-N-S number for the organisation; it can then publish straight away.
   - **Personal**. New personal accounts must first run a **closed test with at least 12 testers for 14 days** before they can release to everyone (step 7).

## 2. Create the app — **You**

Play Console → **Create app**:

| Field | Answer |
| --- | --- |
| App name | `Daily Hadith & Azan TV` |
| Default language | English (Australia) — en-AU |
| App or game | App |
| Free or paid | Free |
| Declarations | Tick both (Developer Programme Policies, US export laws) |

## 3. App signing — use our key

So the Play version and the APK on GitHub are the same app (TVs can update from one to the other), give Play **our** key instead of letting it make a new one:

1. Play Console → the app → **Test and release → Setup → App signing** (or when uploading the first bundle) → **Use a different app signing key** → **Export and upload a key from Java keystore**.
2. Download the **encryption public key** it shows (`encryption_public_key.pem`) and open it in a text editor.
3. On GitHub: **Actions → Play signing key → Run workflow**, paste the whole key into the box, run it.
4. When it finishes, download the **play-signing-key** artifact (bottom of the run page), unzip it, and upload the `output.zip` inside to the Play Console.
5. Uploads are then signed with the same key (the Android workflow does that). If Play asks separately for an **upload key certificate**, tell me and I'll add a step that exports it.

The key and its password are backed up in `~/Documents/Games/IslamicTvApps-signing/` (on the Mac that set this up) and in the repo secrets.

## 4. Store listing — Grow → Store presence → Main store listing

**App name** (30 max): `Daily Hadith & Azan TV`

**Short description** (80 max):

```
Prayer times, Azan & Iqamah, Quran and daily Hadith for your mosque or home TV
```

**Full description** (4000 max):

```
Turn any Google TV or Android TV into a mosque display: today's prayer times, the Azan on time, an Iqamah countdown, Quran recitation and a Hadith of the Day from sunnah.com, in English and Arabic.

PRAYER TIMES THAT MATCH YOUR MOSQUE
• 33 mosques across Australia, with the same Adhan and Iqamah times as awqat.com.au and the mosques' own timetables (Preston Mosque / isv.org.au), including Jumu'ah
• Daylight saving applied automatically, Hijri date, Qibla direction
• Live countdown to the next prayer

AZAN AND IQAMAH, ON TIME
• Plays the Azan automatically at each prayer: Makkah, Madinah, Mishary Alafasy, Masjid Al-Aqsa or Sheikh Abdul Basit — a different voice for each prayer if you like
• Full-screen Iqamah countdown between the Adhan and the Iqamah, then "Prayer in progress" with the screen dimmed
• The Iqamah of Masjid al-Haram at Iqamah time (can be turned off for all prayers or one by one)

BUILT FOR THE TV
• Can open by itself when the TV is switched on and goes straight to the prayer times, so the Azan plays after a power cut too
• Keeps the screen on; works fully with the remote (D-pad, OK, Back, play/pause)
• Seven themes, including Time of Day (the colours follow the prayer times) and a light Parchment theme; brightness for the night

QURAN RECITATION
• All 114 surahs from 13 reciters (Alafasy, Sudais, Shuraym, Maher al-Mu'aiqly, Yasser ad-Dussary, Abdul Basit, Husary, Minshawi and more)
• The verse being recited in Uthmani script, with the Saheeh International translation
• Pauses by itself for the Azan and the prayer, and always carries on from where it stopped

HADITH OF THE DAY
• Hadiths from all 17 collections on sunnah.com, with the book reference and grade; those graded weak or fabricated are left out
• Slides through Hadiths at the speed you choose, or by topic

ENGLISH AND ARABIC
• Screen and Hadith languages chosen separately; full right-to-left Arabic interface with Arabic numerals

PRIVATE
• No account, no ads, no tracking. Your settings stay on your TV.
```

**Arabic listing** (Store listing → Manage translations → Add Arabic, optional):

- Name: `الحديث اليومي والأذان للتلفاز`
- Short description: `مواقيت الصلاة والأذان والإقامة والقرآن والحديث اليومي لتلفاز المسجد والمنزل`
- Full description:

```
حوّل أي تلفاز Google TV أو Android TV إلى شاشة مسجد: مواقيت الصلاة، والأذان في وقته، والعد التنازلي للإقامة، وتلاوة القرآن، وحديث اليوم من sunnah.com، بالعربية والإنجليزية.

• مواقيت 33 مسجدًا في أستراليا مطابقة لموقع أوقات (awqat.com.au) وجداول المساجد، مع الجمعة والتوقيت الصيفي والتاريخ الهجري والقبلة
• الأذان تلقائيًا بأصوات مكة والمدينة ومشاري العفاسي والمسجد الأقصى والشيخ عبد الباسط
• عدّ تنازلي للإقامة بملء الشاشة، وإقامة المسجد الحرام عند وقتها
• يمكنه الفتح تلقائيًا عند تشغيل التلفاز، ويبقي الشاشة مضاءة، ويعمل بالكامل بجهاز التحكم
• تلاوة السور الـ114 بصوت 13 قارئًا مع عرض الآية، ويتوقف للأذان والصلاة ثم يكمل من حيث توقف
• حديث اليوم من الكتب السبعة عشر في sunnah.com مع المرجع والدرجة
• واجهة عربية كاملة من اليمين إلى اليسار
• بلا حساب ولا إعلانات ولا تتبع
```

**Graphics**: upload `graphics/icon-512.png`, `graphics/feature-graphic-1024x500.png`.
**Screenshots**: upload `screenshots/1…6` under **Android TV** (TV banner: `graphics/tv-banner-1280x720.png`), and the same files under **Phone** and **7-inch / 10-inch tablet** (Play requires phone screenshots because the app also installs on phones; 16:9 is accepted).

**Category**: Lifestyle (or Books & Reference). **Tags**: Religion, Prayer times.
**Contact details**: an email address (shown publicly on the listing) and website `https://github.com/IslamicApplications/IslamicTvApps`.

## 5. App content — Policy → App content — **You** (answers below)

| Form | Answer |
| --- | --- |
| Privacy policy | `https://islamicapplications.github.io/IslamicTvApps/privacy.html` |
| App access | All functionality is available without special access |
| Ads | No, the app does not contain ads |
| Content rating | Category **Reference, News, or Educational**. Violence, sex, language, drugs, gambling, user-generated content, sharing location, digital purchases: **No** to all. Expected rating: Everyone / PEGI 3 |
| Target audience | **13 and over** (13–15, 16–17, 18 and over). Not directed at children (keeps the app out of the Families programme) |
| News app | No |
| Data safety | **Does your app collect or share any required user data types? No.** (Settings stay on the device; the downloads in the privacy policy send nothing about the user.) Data is encrypted in transit: Yes. Account creation: not applicable |
| Government app | No |
| Financial features | None |
| Health | None |

## 6. Android TV — Test and release → Advanced settings → Form factors

1. **Add form factor → Android TV**, opt in, and accept the TV guidelines.
2. Make sure the TV banner and TV screenshots from step 4 are on the listing.
3. Google reviews TV apps separately against the [TV app quality guidelines](https://developer.android.com/docs/quality-guidelines/tv-app-quality). The app already has: a Leanback launcher entry and banner, no touchscreen requirement, full D-pad control, Back that closes dialogs and then leaves.

## 7. Release

1. **Countries**: Production → Countries/regions → **Australia** (the mosques are all in Australia; add more later if other mosques are added).
2. **Personal account**: Testing → **Closed testing** → create a track, upload `DailyHadithAzan-TV.aab`, add at least 12 testers (an email list or Google Group), and keep it running for 14 days. Then apply for production access.
   **Organisation account**: go straight to **Production → Create new release**.
3. Upload `DailyHadithAzan-TV.aab` from the latest release. Release name and notes, e.g. `1.3 — First release: prayer times, Azan and Iqamah, Quran recitation and Hadith of the Day for Google TV.`
4. **Review and roll out**. TV reviews usually take a few days to a week.

**Updates**: the app shows the live site, so web changes reach everyone without a new release. Only when `android/` changes: let the Android workflow build, then upload the new `.aab` from the latest release (the version code goes up by itself).

## If the review rejects it

- **"Minimum functionality" / "just a website"**: reply that it's a dedicated TV display that opens at start-up, keeps the screen on, and plays the Azan and Iqamah automatically without interaction — things a browser can't do on a TV. Pointing to the description and screenshots usually helps.
- **Opening at start-up / "Display over other apps"**: ask me for a Play build without the start-up receiver and that permission (the GitHub APK can keep it).
- **Background audio** (the Azan/Quran keep playing when another app is open): ask me to pause the Quran when the app is in the background in the Play build; the Azan at prayer time is the app's purpose and can be explained in the reply.
