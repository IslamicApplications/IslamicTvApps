// Downloads prayer timetables, Adhan adjustments, Iqamah times, Jumu'ah notices and
// the Hijri day offset for every mosque on https://www.awqat.com.au/ and writes them
// to src/shared/data/awqat.json, so the app shows exactly what Awqat shows.
//
// Awqat doesn't allow other sites to read its files from the browser, so this runs
// at build time:  npm run awqat:data
import fs from 'node:fs';
import vm from 'node:vm';

const BASE = 'https://www.awqat.com.au/';
const OUT = new URL('../src/shared/data/awqat.json', import.meta.url);

// App mosque id -> Awqat page (folder, or a page file)
const MOSQUES = {
  'melbourne-general': 'index2.html',
  amssa: 'amssa/',
  fmf: 'fmf/',
  fmm: 'fmm/',
  icmgbrimbank: 'icmgbrimbank/',
  iamm: 'iamm/',
  imc: 'imc/',
  imcv: 'imcv/',
  mic: 'mic/',
  mkw: 'mkw/',
  nfa: 'nfa/',
  lsmf: 'lsmf/',
  swmh: 'swmh/',
  umma: 'umma/',
  altaqwamasjid: 'altaqwamasjid/',
  aycc: 'aycc/',
  gwm: 'gwm/',
  mbm: 'mbm/',
  mgm: 'mgm/',
  marr: 'marr/',
  rca: 'rca/',
  pcic: 'pcic/',
  vmm: 'vmm/',
  akm: 'sa/akm/',
  amc: 'sa/amc/',
  atic: 'sa/atic/',
  hmt: 'tas/hmt/'
};

const PRAYERS = ['FAJR', 'SHOROQ', 'DOHR', 'ASR', 'MAGHRIB', 'ISHA'];

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (daily-hadith awqat sync)' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const text = await res.text();
  // Missing files come back as the site's HTML page
  if (!url.endsWith('/') && !url.endsWith('.html') && /^\s*<!DOCTYPE/i.test(text)) throw new Error(`Not found: ${url}`);
  return text.replace(/^﻿/, '');
}

/** Runs one of Awqat's small data scripts and returns the variables it defines. */
function runScript(code, names) {
  const context = {};
  vm.runInNewContext(code.replace(/\b(const|let)\s/g, 'var '), context);
  return Object.fromEntries(names.map((n) => [n, context[n]]));
}

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Awqat's timetables are in local clock time for one year, with daylight saving
 * already applied. Find the DST period (where every time jumps by an hour) so the
 * app can store standard time and apply each year's own DST dates.
 */
function parseTimetable(code) {
  const { JS_TIMES } = runScript(code, ['JS_TIMES']);
  const rows = JS_TIMES.map((line) => {
    const [date, times] = line.split('~~~~~');
    return { date, times: times.split('|').map(toMinutes) };
  });
  if (rows.length < 365) throw new Error(`Timetable has only ${rows.length} days`);
  const jumps = [];
  for (let i = 1; i < rows.length; i++) {
    const shift = rows[i].times[2] - rows[i - 1].times[2]; // Dhuhr moves < 1 min a day otherwise
    if (Math.abs(shift) >= 45) jumps.push({ date: rows[i].date, shift });
  }
  const ends = jumps.find((j) => j.shift < 0)?.date; // first standard-time day (April)
  const starts = jumps.find((j) => j.shift > 0)?.date; // first DST day (October)
  if (jumps.length && !(jumps.length === 2 && ends && starts && ends < starts)) {
    throw new Error(`Unexpected DST jumps: ${JSON.stringify(jumps)}`);
  }
  const inDst = (date) => !!(ends && starts) && (date < ends || date >= starts);
  return {
    dst: ends && starts ? { ends, starts } : null,
    // date "MM-DD" -> [Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha] in standard-time minutes
    days: Object.fromEntries(rows.map((r) => [r.date, r.times.map((t) => t - (inDst(r.date) ? 60 : 0))]))
  };
}

const PRAYTIMES_OUT = new URL('../src/shared/vendor/awqatPrayTimes.js', import.meta.url);
let prayTimesSource = null;

/**
 * Pages without a timetable file calculate times on the device with Awqat's copy of
 * PrayTimes.js (praytimes.org, LGPL). The app runs that same script, so keep its
 * settings and save the script next to the data.
 */
async function calculationSettings(html, folder, id) {
  const src = html.match(/src='([^']*PrayTimes\.js)'/)?.[1];
  const gps = [...html.matchAll(/^\s*var\s+JS_GPS_FULL_CODE\s*=\s*"([^"]+)"/gm)].map((m) => m[1]).pop();
  const setting = (name) => [...html.matchAll(new RegExp(`^\\s*var\\s+${name}\\s*=\\s*"([^"]*)"`, 'gm'))].map((m) => m[1]).pop() ?? '';
  if (!src || !gps) throw new Error(`${id}: no timetable file and no GPS settings`);
  const [, , lat, lng, timezone] = gps.split('|');

  const source = (await get(new URL(src, folder).href)).replace(/\r\n?/g, '\n');
  if (prayTimesSource && prayTimesSource !== source) throw new Error(`${id}: a different PrayTimes.js`);
  prayTimesSource = source;

  return {
    calc: {
      lat: Number(lat),
      lng: Number(lng),
      timezone: Number(timezone),
      method: setting('JS_GPS_CALC_METHOD') || 'MWL',
      asr: setting('JS_GPS_ASR_TYPE') || 'Standard'
    }
  };
}

const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
const cities = {};
const mosques = {};
// Mosques whose page couldn't be read keep their last synced data, so one page that
// is down or removed from Awqat doesn't hold back every other mosque
const failed = [];

for (const [id, path] of Object.entries(MOSQUES)) {
  try {
    await syncMosque(id, path);
  } catch (err) {
    failed.push(id);
    const kept = previous?.mosques?.[id];
    if (kept) mosques[id] = kept;
    console.warn(`::warning::${id}: ${err.message} (${kept ? 'kept its last synced data' : 'no earlier data, left out'})`);
  }
}

if (failed.length === Object.keys(MOSQUES).length) {
  console.error('Every Awqat page failed; the data file is left as it was.');
  process.exit(1);
}

// Timetables of mosques that kept their old data, unless a synced mosque shares it
for (const { timetable } of Object.values(mosques)) {
  if (!cities[timetable] && previous?.cities?.[timetable]) cities[timetable] = previous.cities[timetable];
}

async function syncMosque(id, path) {
  const pageUrl = new URL(path, BASE).href;
  const folder = new URL('./', pageUrl).href;
  const html = await get(pageUrl);

  const adjust = PRAYERS.map((p) => {
    const m = html.match(new RegExp(`var\\s+JS_ATHAN_MINUTES_OF_${p}\\s*=\\s*(-?\\d+)`));
    if (!m) throw new Error(`${id}: no Adhan adjustment for ${p}`);
    return Number(m[1]);
  });
  const city = html.match(/var\s+JS_CITY_CODE\s*=\s*"([^"]+)"/)?.[1] ?? '';

  // Iqamah: minutes after the Adhan, or fixed clock times when set. The general
  // city timetable (index2.html) has none.
  let iqama = null;
  if (html.includes('iqamafixed.js')) {
    const iqamaFile = runScript(await get(new URL('iqamafixed.js', folder).href), ['FIXED_IQAMA_TIMES', 'JS_IQAMA_TIME']);
    iqama = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map((name, i) => {
      const fixed = String(iqamaFile.FIXED_IQAMA_TIMES?.[i + 1] ?? '').trim();
      return fixed ? { name, fixed } : { name, after: Number(iqamaFile.JS_IQAMA_TIME[i + 1]) };
    });
  }

  // Hijri day offset: a number on the page, or the shared hijridate.js default
  const offsetSetting = html.match(/JS_HIJRI_DECALAGE\s*=\s*(-?\d+|JS_HIJRI_DECALAGE_DEFAULT)\s*;/)?.[1];
  let hijriOffset = 0;
  if (offsetSetting === 'JS_HIJRI_DECALAGE_DEFAULT') {
    const hijriSrc = html.match(/src='([^']*hijridate\.js)/)?.[1];
    if (!hijriSrc) throw new Error(`${id}: no hijridate.js`);
    hijriOffset = Number(runScript(await get(new URL(hijriSrc, folder).href), ['JS_HIJRI_DECALAGE_DEFAULT']).JS_HIJRI_DECALAGE_DEFAULT);
  } else if (offsetSetting) {
    hijriOffset = Number(offsetSetting);
  }

  // Name and notice board message (usually Jumu'ah times)
  let name = '';
  let message = '';
  try {
    const lang = await get(new URL('lang-EN.ini', folder).href);
    name = lang.match(/HereMosqueName\s*:\s*"([^"]*)"/)?.[1]?.trim() ?? '';
    message = lang.match(/HereMosqueMessage\s*:\s*"([^"]*)"/)?.[1]?.trim() ?? '';
  } catch {}

  // Timetable file (Victoria) or calculated on the page (SA, TAS)
  const byFiles = Number(html.match(/var\s+JS_APP_TIMES_BY_FILES\s*=\s*([01])/)?.[1] ?? 1);
  let timetable = city;
  if (byFiles) {
    if (!cities[city]) {
      const file = html.match(/var\s+JS_SCRIPT_FILE\s*=\s*'([^']*)wtimes-'/)?.[1];
      if (!file) throw new Error(`${id}: no timetable file`);
      cities[city] = parseTimetable(await get(new URL(`${file}wtimes-${city}.ini`, folder).href));
    }
  } else {
    timetable = `calculated:${id}`;
    cities[timetable] = await calculationSettings(html, folder, id);
  }

  mosques[id] = { page: pageUrl, timetable, adjust, iqama, hijriOffset, name, message };
  console.log(`${id.padEnd(18)} ${timetable.padEnd(20)} adjust ${adjust.join(',').padEnd(16)} iqama ${(iqama?.map((q) => q.fixed ?? '+' + q.after).join(',') ?? '-').padEnd(18)} hijri ${hijriOffset >= 0 ? '+' : ''}${hijriOffset}  ${message}`);
}

for (const [city, t] of Object.entries(cities)) {
  console.log(t.calc ? `${city}: PrayTimes.js ${JSON.stringify(t.calc)}` : `${city}: ${Object.keys(t.days).length} days, DST in file ${t.dst ? `until ${t.dst.ends}, from ${t.dst.starts}` : 'none'}`);
}

if (prayTimesSource) {
  fs.mkdirSync(new URL('./', PRAYTIMES_OUT), { recursive: true });
  fs.writeFileSync(
    PRAYTIMES_OUT,
    `// Awqat's copy of PrayTimes.js (${BASE}www/PrayTimes.js), saved by scripts/sync-awqat.mjs.\n` +
      '// Do not edit: it is replaced on every sync.\n' +
      `${prayTimesSource}\n\nexport default PrayTimes;\n`
  );
}

// The date moves only when something changed, so the daily sync doesn't redeploy for nothing
const unchanged = previous && JSON.stringify({ cities: previous.cities, mosques: previous.mosques }) === JSON.stringify({ cities, mosques });
const fetched = unchanged ? previous.fetched : new Date().toISOString().slice(0, 10);
fs.writeFileSync(OUT, JSON.stringify({ source: BASE, fetched, cities, mosques }));
console.log(`Wrote ${OUT.pathname} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
