// Downloads the yearly timetables (Adhan and Iqamah for every day, plus Jumu'ah) that
// mosques publish through The Masjid App widget on their own website, and writes them
// to src/shared/data/mosqueTimetables.json:  npm run mosques:data
//
// Preston Mosque (https://isv.org.au/) embeds https://themasjidapp.org/128422/prayers;
// the page carries the whole year in its __NEXT_DATA__ script.
import fs from 'node:fs';

const OUT = new URL('../src/shared/data/mosqueTimetables.json', import.meta.url);
const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

// App mosque id -> mosque website and its Masjid App id
const MOSQUES = {
  isv: { site: 'https://isv.org.au/', masjidApp: 128422 }
};

const ADHAN = ['fajr', 'sunrise', 'zuhr', 'asr', 'maghrib', 'isha'];
const IQAMA = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

/** "4:04 AM" / "1:33 pm" -> minutes after midnight */
function toMinutes(value) {
  const m = String(value).trim().match(/^(\d{1,2}):(\d{2})\s*([ap]m)$/i);
  if (!m) throw new Error(`Unexpected time "${value}"`);
  return (Number(m[1]) % 12) * 60 + Number(m[2]) + (m[3].toLowerCase() === 'pm' ? 720 : 0);
}

/** Day 1…365 of the table -> "MM-DD" (the table has no 29 February) */
function dayKey(n) {
  const d = new Date(Date.UTC(2025, 0, n));
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function loadMasjid(id) {
  const res = await fetch(`https://themasjidapp.org/${id}/prayers`, { headers: { 'User-Agent': 'Mozilla/5.0 (daily-hadith timetable sync)' } });
  if (!res.ok) throw new Error(`${res.status} themasjidapp.org/${id}`);
  const html = await res.text();
  const json = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!json) throw new Error(`No timetable data on themasjidapp.org/${id}`);
  return JSON.parse(json).props.pageProps.masjid;
}

const out = {};
for (const [appId, { site, masjidApp }] of Object.entries(MOSQUES)) {
  const masjid = await loadMasjid(masjidApp);
  const adhans = masjid.azanParams?.imported;
  const iqamas = masjid.iqamas;
  if (!adhans || !iqamas) throw new Error(`${appId}: no yearly timetable`);

  // Wall-clock times, one column per Adhan and Iqamah
  const columns = [
    ...ADHAN.map((p) => Array.from({ length: 365 }, (_, i) => toMinutes(adhans[i + 1][p]))),
    ...IQAMA.map((p) => Array.from({ length: 365 }, (_, i) => toMinutes(iqamas[i + 1][p])))
  ];
  // Stored in standard time; the app adds daylight saving for the actual year. Each
  // column is undone on its own jumps, as some columns change a day or two off (Preston's
  // Fajr goes back on 3 April, the others on 5 April). 1 January is in daylight saving
  // when Dhuhr is after 12:50 (it's 12:05–12:40 in standard time across Australia).
  const startDst = columns[2][0] > 12 * 60 + 50 ? 60 : 0;
  const standard = columns.map((col, c) => {
    let dst = startDst;
    return col.map((t, i) => {
      const jump = i ? t - col[i - 1] : 0;
      if (jump <= -45) dst -= 60;
      else if (jump >= 45) dst += 60;
      if (dst !== 0 && dst !== 60) throw new Error(`${appId}: unexpected jump in column ${c} on ${dayKey(i + 1)}`);
      return t - dst;
    });
  });
  const days = {};
  for (let i = 0; i < 365; i++) days[dayKey(i + 1)] = standard.map((col) => col[i]);
  const dstDays = columns[2].filter((t, i) => t !== standard[2][i]).length;

  const jumuah = (masjid.events ?? [])
    .filter((e) => e.isJuma && e.timeDesc?.trim())
    .map((e) => e.timeDesc.trim())
    .join(' & ');

  const entry = {
    site,
    widget: `https://themasjidapp.org/${masjidApp}/prayers`,
    name: masjid.name,
    timeZone: masjid.timezone,
    fetched: new Date().toISOString().slice(0, 10),
    jumuah: jumuah || null,
    /** "MM-DD" -> Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha Adhan, then Fajr, Dhuhr, Asr, Maghrib, Isha Iqamah, in standard-time minutes */
    days
  };
  // The date moves only when something changed, so the daily sync doesn't redeploy for nothing
  const before = previous[appId];
  if (before && JSON.stringify({ ...before, fetched: '' }) === JSON.stringify({ ...entry, fetched: '' })) entry.fetched = before.fetched;
  out[appId] = entry;
  console.log(`${appId}: ${masjid.name}, 365 days (${dstDays} with daylight saving), Jumu'ah ${jumuah || 'none'}`);
}

fs.writeFileSync(OUT, JSON.stringify(out));
