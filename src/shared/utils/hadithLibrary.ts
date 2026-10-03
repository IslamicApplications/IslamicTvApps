/**
 * The Daily Hadith library: every Hadith published on sunnah.com (17 collections,
 * 50,884 Hadiths), built by scripts/build-hadith-data.mjs into small JSON chunks
 * that are downloaded only when needed.
 */
import { Hadith, DailySelection, GradeCategory, HadithGrade } from '../types/hadith';
import { SITE_ROOT } from './siteRoot';
import { getDaysSinceEpoch, formatDateKey, getDailyHadith as getBundledDailyHadith } from './dailyEngine';
import { getHijriDate } from './hijri';
import { collectionName } from '../i18n';

interface LibraryCollection {
  slug: string;
  name: string;
  count: number;
  books: string[];
  /** Arabic book names (missing in libraries saved before they were added) */
  booksAr?: string[];
  /** sunnah.com book id per book, as in its URLs: "12", "35b" or "introduction" */
  bookRefs: string[];
  /** Position in the collection where each book starts (books are contiguous) */
  bookStarts?: number[];
}

interface LibraryIndex {
  total: number;
  chunkSize: number;
  /** [grade, category, graded by] */
  grades: [string, GradeCategory, string][];
  /** Sorted positions graded other than Sahih or Hasan (Daʻif, Mawduʻ…); these are never shown */
  excluded: number[];
  collections: LibraryCollection[];
}

/** [book index, number within book, narrator, English text, Arabic (only when there is no English), grade id] */
type HadithRecord = [number, number, string, string, string?, number?];

const LIBRARY_URL = `${SITE_ROOT}hadith/v3/`;

let indexPromise: Promise<LibraryIndex> | null = null;
const chunkPromises = new Map<string, Promise<HadithRecord[]>>();

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export function loadLibraryIndex(): Promise<LibraryIndex> {
  if (!indexPromise) {
    indexPromise = fetchJson<LibraryIndex>(`${LIBRARY_URL}index.json`).then((index) =>
      // An index saved on the device before book positions were added: fetch it fresh
      index.collections.every((c) => c.bookStarts) ? index : fetchJson<LibraryIndex>(`${LIBRARY_URL}index.json?v=books`)
    );
    indexPromise.catch(() => (indexPromise = null)); // retry later (e.g. back online)
  }
  return indexPromise;
}

function loadChunk(slug: string, chunk: number): Promise<HadithRecord[]> {
  const key = `${slug}/${chunk}`;
  let promise = chunkPromises.get(key);
  if (!promise) {
    promise = fetchJson<HadithRecord[]>(`${LIBRARY_URL}${key}.json`);
    promise.catch(() => chunkPromises.delete(key));
    chunkPromises.set(key, promise);
  }
  return promise;
}

const EXCERPT_WORDS = 60;

/**
 * sunnah.com page for a Hadith. Positions within a book match sunnah.com's
 * "In-book reference", so the link opens the exact book; single-book collections
 * (the Forty Hadith books) link straight to the Hadith.
 */
function sunnahUrl(collection: LibraryCollection, book: number, number: number): string {
  if (collection.books.length === 1) return `https://sunnah.com/${collection.slug}:${number}`;
  return `https://sunnah.com/${collection.slug}/${collection.bookRefs[book]}`;
}

/** sunnah.com's wording, e.g. "In-book reference: Book 12, Hadith 102". */
function inBookReference(collection: LibraryCollection, book: number, number: number): string {
  if (collection.books.length === 1) return `Hadith ${number}`;
  const ref = collection.bookRefs[book];
  return `In-book reference: ${ref === 'introduction' ? 'Introduction' : `Book ${ref}`}, Hadith ${number}`;
}

function toHadith(index: LibraryIndex, collection: LibraryCollection, record: HadithRecord, localIndex: number): Hadith {
  const [book, number, narrator, english, arabic, gradeId] = record;
  const grade = gradeId === undefined ? undefined : index.grades[gradeId];
  const isArabic = !english;
  const text = english || arabic || '';
  const words = text.split(/\s+/).filter(Boolean);
  const isLong = words.length > EXCERPT_WORDS + 20;
  return {
    id: `${collection.slug}-${book + 1}-${number}`,
    collection: collection.name,
    collectionSlug: collection.slug,
    localIndex,
    source: 'sunnah.com',
    isArabic,
    reference: inBookReference(collection, book, number),
    volume: 0,
    bookNumber: parseInt(collection.bookRefs[book], 10) || 0,
    bookName: collection.books[book] ?? '',
    bookNameAr: collection.booksAr?.[book] || undefined,
    hadithNumber: String(number),
    narrator,
    text,
    excerpt: isLong ? `${words.slice(0, EXCERPT_WORDS).join(' ')}…` : text,
    isLong,
    wordCount: words.length,
    startPage: 0,
    endPage: 0,
    pdfPage: 0,
    sourceUrl: sunnahUrl(collection, book, number),
    grade: grade && { text: grade[0], category: grade[1], by: grade[2] }
  };
}

/** Loads the Hadith at a position (0 … total-1) across all collections. */
export async function loadHadithAt(position: number): Promise<Hadith> {
  const index = await loadLibraryIndex();
  let local = ((position % index.total) + index.total) % index.total;
  for (const collection of index.collections) {
    if (local < collection.count) {
      const records = await loadChunk(collection.slug, Math.floor(local / index.chunkSize));
      return toHadith(index, collection, records[local % index.chunkSize], local);
    }
    local -= collection.count;
  }
  throw new Error('Hadith position out of range');
}

export interface LibraryBook {
  name: string;
  nameAr: string;
  start: number;
  count: number;
}

export interface LibraryCollectionInfo {
  slug: string;
  name: string;
  books: LibraryBook[];
}

/** Collections and their books, for browsing the Library. */
export async function loadLibraryCollections(): Promise<LibraryCollectionInfo[]> {
  const index = await loadLibraryIndex();
  return index.collections.map((c) => {
    const starts = c.bookStarts ?? [0];
    return {
      slug: c.slug,
      name: c.name,
      books: c.books.map((name, i) => ({
        name,
        nameAr: c.booksAr?.[i] || name,
        start: starts[i] ?? 0,
        count: (starts[i + 1] ?? c.count) - (starts[i] ?? 0)
      }))
    };
  });
}

/**
 * Hadiths start…end-1 of a collection (positions within it), leaving out the ones
 * the app never shows (Daʻif, Mawduʻ, incomplete).
 */
export async function loadCollectionRange(
  slug: string,
  start: number,
  end: number,
  onProgress?: (done: number, total: number) => void
): Promise<Hadith[]> {
  const index = await loadLibraryIndex();
  let offset = 0;
  const collection = index.collections.find((c) => {
    if (c.slug === slug) return true;
    offset += c.count;
    return false;
  });
  if (!collection) return [];
  const excluded = new Set(index.excluded);
  const first = Math.floor(start / index.chunkSize);
  const last = Math.floor((Math.min(end, collection.count) - 1) / index.chunkSize);
  const result: Hadith[] = [];
  for (let chunk = first; chunk <= last; chunk++) {
    const records = await loadChunk(slug, chunk);
    records.forEach((record, i) => {
      const local = chunk * index.chunkSize + i;
      if (local >= start && local < end && !excluded.has(offset + local)) {
        result.push(toHadith(index, collection, record, local));
      }
    });
    onProgress?.(chunk - first + 1, last - first + 1);
  }
  return result;
}

/** How many Hadiths can be shown: Sahih, Hasan or ungraded. */
export function shownCount(index: LibraryIndex): number {
  return index.total - index.excluded.length;
}

/** Library position of the n-th shown Hadith (0 … shownCount-1), skipping the excluded ones. */
export function shownPosition(index: LibraryIndex, rank: number): number {
  const { excluded } = index;
  const countUpTo = (p: number) => {
    let lo = 0;
    let hi = excluded.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (excluded[mid] <= p) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  let position = rank;
  for (let skipped = countUpTo(position); rank + skipped !== position; skipped = countUpTo(position)) {
    position = rank + skipped;
  }
  return position;
}

/**
 * Shuffled order of the whole library: a keyed Feistel permutation (with cycle walking),
 * so day n maps to a random-looking Hadith and every Hadith appears once before any repeats.
 */
export function shuffledPosition(n: number, total: number): number {
  let bits = 2;
  while (1 << bits < total) bits++;
  if (bits % 2) bits++;
  const half = bits / 2;
  const mask = (1 << half) - 1;
  const round = (value: number, key: number) => {
    let h = Math.imul(value ^ key, 0x9e3779b1);
    h ^= h >>> 15;
    h = Math.imul(h, 0x85ebca77);
    h ^= h >>> 13;
    return h & mask;
  };
  const keys = [0x5ad1e1, 0x1f2b3c, 0x7a6b5c, 0x3c2d1e];
  let x = n;
  do {
    let left = x >>> half;
    let right = x & mask;
    for (const key of keys) {
      [left, right] = [right, left ^ round(right, key)];
    }
    x = (left << half) | right;
  } while (x >= total);
  return x;
}

// A few entries only point to another Hadith ("As above.", "See hadith 4909"); they're not used as a daily pick.
const CROSS_REFERENCE = /^[\s(\["]*(as above|see (the )?(previous|above|next) hadith|see hadith|as (in )?hadith (no\.?|number))/i;

const dailyCache = new Map<string, DailySelection>();

const arabicChunks = new Map<string, Promise<string[]>>();

/** The original Arabic of a sunnah.com Hadith, or null for Hadiths outside the library or without Arabic. */
// Arabic texts already downloaded, by Hadith id (null: this Hadith has none)
const arabicTexts = new Map<string, string | null>();

/** The Arabic text if it is already downloaded (undefined while it isn't), so it can be shown without a flash of English. */
export function peekArabicText(h: Hadith): string | null | undefined {
  if (h.isArabic) return h.text;
  if (h.source !== 'sunnah.com' || !h.collectionSlug || h.localIndex === undefined) return null;
  return arabicTexts.get(h.id);
}

export async function loadArabicText(h: Hadith): Promise<string | null> {
  if (h.source !== 'sunnah.com' || !h.collectionSlug || h.localIndex === undefined) return null;
  if (h.isArabic) return h.text;
  const known = arabicTexts.get(h.id);
  if (known !== undefined) return known;
  const { chunkSize } = await loadLibraryIndex();
  const key = `${h.collectionSlug}/${Math.floor(h.localIndex / chunkSize)}`;
  let promise = arabicChunks.get(key);
  if (!promise) {
    promise = fetchJson<string[]>(`${LIBRARY_URL}ar/${key}.json`);
    promise.catch(() => arabicChunks.delete(key));
    arabicChunks.set(key, promise);
  }
  const text = (await promise)[h.localIndex % chunkSize] || null;
  arabicTexts.set(h.id, text);
  return text;
}

/** The Hadith with its text swapped for the Arabic original (the chain of narrators is part of the Arabic). */
export function withArabicText(h: Hadith, arabic: string): Hadith {
  const words = arabic.split(/\s+/).filter(Boolean);
  const isLong = words.length > EXCERPT_WORDS + 20;
  return {
    ...h,
    narrator: '',
    text: arabic,
    excerpt: isLong ? `${words.slice(0, EXCERPT_WORDS).join(' ')}…` : arabic,
    isLong,
    wordCount: words.length,
    isArabic: true
  };
}

/** Hadith of the Day from the full sunnah.com library — the same on every device. */
export async function loadDailyHadith(date: Date = new Date()): Promise<DailySelection> {
  const dateString = formatDateKey(date);
  const cached = dailyCache.get(dateString);
  if (cached) return cached;

  const index = await loadLibraryIndex();
  // Shuffle only the Hadiths that are shown (Sahih, Hasan or ungraded)
  const count = shownCount(index);
  const day = ((getDaysSinceEpoch(date) % count) + count) % count;
  let rank = shuffledPosition(day, count);
  let position = shownPosition(index, rank);
  let hadith = await loadHadithAt(position);
  // "As above" entries are replaced by the Hadith they point back to
  for (let i = 0; i < 5 && hadith.text.length < 80 && CROSS_REFERENCE.test(hadith.text); i++) {
    rank = (rank - 1 + count) % count;
    position = shownPosition(index, rank);
    hadith = await loadHadithAt(position);
  }

  const selection: DailySelection = { dateString, hadith, index: position, hijriDate: getHijriDate(date).formatted };
  dailyCache.set(dateString, selection);
  return selection;
}

/** Hadith of the Day, or the bundled Bukhari pick when the library can't be reached (offline first run). */
export async function loadDailyHadithOrBundled(date: Date = new Date()): Promise<DailySelection> {
  try {
    return await loadDailyHadith(date);
  } catch (err) {
    console.warn('Hadith library unavailable, using the bundled collection:', err);
    return getBundledDailyHadith(date);
  }
}

/** URL of the chunk file holding a Hadith (used to check offline availability). */
export async function chunkUrlFor(position: number): Promise<string> {
  const index = await loadLibraryIndex();
  let local = position;
  for (const collection of index.collections) {
    if (local < collection.count) return `${LIBRARY_URL}${collection.slug}/${Math.floor(local / index.chunkSize)}.json`;
    local -= collection.count;
  }
  return `${LIBRARY_URL}index.json`;
}

/** Any shown Hadith (Sahih, Hasan or ungraded) from the whole library, chosen at random. */
export async function loadRandomHadith(): Promise<Hadith> {
  const index = await loadLibraryIndex();
  return loadHadithAt(shownPosition(index, Math.floor(Math.random() * shownCount(index))));
}

/** Short human reference, e.g. "Sahih Muslim • The Book of Faith • In-book reference: Book 1, Hadith 12". */
type UiLanguage = 'en' | 'ar';

/** "In-book reference: Book 12, Hadith 102" -> "المرجع في الكتاب: كتاب 12، حديث 102" */
function referenceInArabic(reference: string): string {
  return reference
    .replace('In-book reference: ', 'المرجع في الكتاب: ')
    .replace('Introduction', 'المقدمة')
    .replace(/\bBook (\S+)/, 'كتاب $1')
    .replace(/, Hadith /, '، حديث ')
    .replace(/^Hadith /, 'حديث ');
}

export function describeHadith(h: Hadith, language: UiLanguage = 'en'): { collection: string; reference: string; detail: string; sourceLabel: string } {
  const ar = language === 'ar';
  if (h.source === 'sunnah.com') {
    const detail = h.reference ?? `Hadith ${h.hadithNumber}`;
    return {
      collection: collectionName(language, h.collection),
      reference: ar ? h.bookNameAr || h.bookName : h.bookName,
      detail: ar ? referenceInArabic(detail) : detail,
      sourceLabel: 'sunnah.com'
    };
  }
  if (ar) {
    return {
      collection: collectionName(language, h.collection || 'Sahih al-Bukhari'),
      reference: `كتاب ${h.bookNumber}: ${h.bookName}`,
      detail: `المجلد ${h.volume}، حديث رقم ${h.hadithNumber}`,
      sourceLabel: `ملف PDF ص ${h.pdfPage}`
    };
  }
  return {
    collection: h.collection || 'Sahih al-Bukhari',
    reference: `Book ${h.bookNumber}: ${h.bookName}`,
    detail: `Vol. ${h.volume}, Hadith #${h.hadithNumber}`,
    sourceLabel: `Source PDF p. ${h.pdfPage}`
  };
}

const GRADE_WORDS_AR: Record<string, string> = {
  Sahih: 'صحيح',
  Hasan: 'حسن',
  'Daʻif': 'ضعيف',
  'Mawduʻ': 'موضوع',
  Mawquf: 'موقوف',
  'Maqtuʻ': 'مقطوع',
  Mursal: 'مرسل',
  Munkar: 'منكر',
  Shadh: 'شاذ',
  'Maʻlul': 'معلول',
  Mutawatir: 'متواتر',
  Isnad: 'الإسناد',
  Hadith: 'الحديث',
  Matn: 'المتن',
  'li-ghayrihi': 'لغيره',
  Very: 'جدًا'
};

const GRADE_NOTES_AR: Record<string, string> = {
  '(Bukhari and Muslim)': '(البخاري ومسلم)',
  '(Bukhari)': '(البخاري)',
  '(Muslim)': '(مسلم)',
  '(Agreed upon)': '(متفق عليه)'
};

const GRADERS_AR: Record<string, string> = {
  'Al-Albani': 'الألباني',
  'Zubair Ali Zai': 'زبير علي زئي',
  'Salim al-Hilali': 'سليم الهلالي'
};

/** "Hasan Sahih" -> "حسن صحيح", "Isnad Sahih" -> "إسناده صحيح", "Very Daʻif" -> "ضعيف جدًا" */
function gradeInArabic(text: string): string {
  let note = '';
  const base = text.replace(/\s*\([^)]*\)\s*$/, (m) => {
    note = GRADE_NOTES_AR[m.trim()] ?? m.trim();
    return '';
  });
  let words = base.split(/\s+/).filter(Boolean);
  let prefix = '';
  if (words[0] === 'Isnad') {
    prefix = 'إسناده ';
    words = words.slice(1);
  }
  let very = false;
  if (words[0] === 'Very') {
    very = true;
    words = words.slice(1);
  }
  const arabic = words.map((w) => GRADE_WORDS_AR[w] ?? w).join(' ');
  return `${prefix}${arabic}${very ? ' جدًا' : ''}${note ? ` ${note}` : ''}`;
}

/** Badge text and colour for a Hadith's grade, e.g. "Daʻif" / "Graded by Al-Albani". */
export function describeGrade(h: Hadith, language: UiLanguage = 'en'): { label: string; by: string; category: GradeCategory | 'none' } {
  const ar = language === 'ar';
  if (h.grade) {
    const isCollection = h.grade.by === h.collection;
    const label = ar ? gradeInArabic(h.grade.text) : h.grade.text;
    const by = ar
      ? isCollection
        ? `من ${collectionName(language, h.collection)}`
        : `حكم ${GRADERS_AR[h.grade.by] ?? h.grade.by}`
      : isCollection
        ? `Part of ${h.collection}`
        : `Graded by ${h.grade.by}`;
    return { label, by, category: h.grade.category };
  }
  if (h.source !== 'sunnah.com') {
    return ar
      ? { label: 'صحيح', by: 'من صحيح البخاري', category: 'sahih' }
      : { label: 'Sahih', by: 'Part of Sahih al-Bukhari', category: 'sahih' };
  }
  return ar
    ? { label: 'بلا حكم', by: 'لا يوجد حكم لهذه المجموعة', category: 'none' }
    : { label: 'Not graded', by: 'No grade available for this collection', category: 'none' };
}

/** "Grade: Daʻif (Al-Albani)" for sharing and copying, or '' when there is no grade. */
export function gradeLine(h: Hadith, language: UiLanguage = 'en'): string {
  const g = describeGrade(h, language);
  if (g.category === 'none') return '';
  const source = h.grade && h.grade.by !== h.collection ? h.grade.by : h.collection;
  if (language === 'ar') {
    return `الحكم: ${g.label} (${GRADERS_AR[source] ?? collectionName(language, source)})`;
  }
  return `Grade: ${g.label} (${source})`;
}

/** Citation text used when copying or sharing a Hadith. */
export function citeHadith(h: Hadith, language: UiLanguage = 'en'): string {
  if (language === 'ar') {
    const info = describeHadith(h, language);
    const grade = gradeLine(h, language);
    return `${info.collection}، ${info.reference}، ${info.detail}${grade ? ` — ${grade}` : ''} — ${info.sourceLabel}`;
  }
  if (h.source === 'sunnah.com') {
    const grade = gradeLine(h);
    return `${h.collection}, ${h.bookName}, ${h.reference ?? `Hadith ${h.hadithNumber}`}${grade ? ` — ${grade}` : ''} — sunnah.com`;
  }
  return `Sahih al-Bukhari, Vol. ${h.volume}, Book ${h.bookNumber} (${h.bookName}), Hadith #${h.hadithNumber}, PDF p. ${h.pdfPage}`;
}

export interface HadithTopic {
  id: string;
  name: string;
  nameAr: string;
  positions: number[];
}

let topicsPromise: Promise<HadithTopic[]> | null = null;

/** Topics found by keyword when the library was built (shown Hadiths only). */
export function loadTopics(): Promise<HadithTopic[]> {
  if (!topicsPromise) {
    topicsPromise = fetchJson<HadithTopic[]>(`${LIBRARY_URL}topics.json`);
    topicsPromise.catch(() => (topicsPromise = null));
  }
  return topicsPromise;
}

/** One page of a topic's Hadiths. */
export async function loadTopicPage(topicId: string, page: number, perPage: number): Promise<{ hadiths: Hadith[]; total: number }> {
  const topic = (await loadTopics()).find((t) => t.id === topicId);
  if (!topic) return { hadiths: [], total: 0 };
  const positions = topic.positions.slice((page - 1) * perPage, page * perPage);
  return { hadiths: await Promise.all(positions.map((p) => loadHadithAt(p))), total: topic.positions.length };
}

/** A random Hadith from a topic. */
export async function loadRandomTopicHadith(topicId: string): Promise<Hadith> {
  const topic = (await loadTopics()).find((t) => t.id === topicId);
  if (!topic || topic.positions.length === 0) return loadRandomHadith();
  return loadHadithAt(topic.positions[Math.floor(Math.random() * topic.positions.length)]);
}
