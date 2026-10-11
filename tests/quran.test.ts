import { describe, expect, it } from 'vitest';
import { SURAHS, cleanTranslation, firstVerseNumber, hasVerseTimings, isEnglishReciter, loadRecitation, resumeStartSeconds, resumeTrack, verseAt } from '../src/shared/utils/quran';
import { formatDuration } from '../src/shared/components/QuranPlayer';

describe('quran', () => {
  it('lists all 114 surahs with 6236 verses', () => {
    expect(SURAHS).toHaveLength(114);
    expect(SURAHS.reduce((n, s) => n + s.verses, 0)).toBe(6236);
    expect(SURAHS[8].bismillah).toBe(false);
  });

  it('finds the verse being recited', () => {
    const timings = [
      { verse: 1, from: 0, to: 6000 },
      { verse: 2, from: 6000, to: 11000 },
      { verse: 3, from: 11000, to: 16000 }
    ];
    expect(verseAt(timings, 0)).toBe(0);
    expect(verseAt(timings, 6500)).toBe(1);
    expect(verseAt(timings, 99999)).toBe(2);
  });

  it('removes footnote markers from the translation', () => {
    expect(cleanTranslation('In the name of Allāh,<sup foot_note=195932>1</sup> the Entirely Merciful')).toBe(
      'In the name of Allāh, the Entirely Merciful'
    );
  });

  it('streams Muhammad al-Faqih from Quran Central, without verse timings', async () => {
    expect(hasVerseTimings(2919)).toBe(false);
    expect(hasVerseTimings(7)).toBe(true);
    expect(await loadRecitation(2919, 1)).toEqual({ url: 'https://podcasts.qurancentral.com/muhammad-al-faqih/001.mp3', timings: [] });
    expect((await loadRecitation(2919, 114)).url).toBe('https://podcasts.qurancentral.com/muhammad-al-faqih/114.mp3');
  });

  it('numbers verses through the whole Quran', () => {
    expect(firstVerseNumber(1)).toBe(1);
    expect(firstVerseNumber(2)).toBe(8);
    expect(firstVerseNumber(114) + SURAHS[113].verses - 1).toBe(6236);
  });

  it('plays the English translation by Ibrahim Walk one verse at a time', async () => {
    expect(hasVerseTimings(9001)).toBe(true);
    expect(isEnglishReciter(9001)).toBe(true);
    expect(isEnglishReciter(7)).toBe(false);
    const baqarah = await loadRecitation(9001, 2);
    expect(baqarah.tracks).toHaveLength(286);
    expect(baqarah.url).toBe('https://cdn.islamic.network/quran/audio/192/en.walk/8.mp3');
    expect(baqarah.tracks![285]).toBe('https://cdn.islamic.network/quran/audio/192/en.walk/293.mp3');
    expect((await loadRecitation(9001, 114)).tracks!.at(-1)).toBe('https://cdn.islamic.network/quran/audio/192/en.walk/6236.mp3');
  });

  it('streams the Arabic recitations with English translation surah by surah, without verse timings', async () => {
    expect(hasVerseTimings(9002)).toBe(false);
    expect(await loadRecitation(9002, 1)).toEqual({
      url: 'https://cdn.islamic.network/quran/audio-surah/128/en.misharyrashidalafasyenglishtranslationsaheehibrahimwalk/1.mp3',
      timings: []
    });
    expect((await loadRecitation(9004, 114)).url).toBe('https://cdn.islamic.network/quran/audio-surah/128/en.sudaisandshuraymenglishtranslationpickthallaslamathar/114.mp3');
  });

  it('carries the English translation on from the verse it stopped at', () => {
    const stopped = { surah: 2, reciter: 9001, time: 4.5, verse: 255 };
    expect(resumeTrack(stopped, 2, 286)).toBe(254);
    expect(resumeStartSeconds(stopped, 2, 9001, [])).toBe(4.5); // within Ayat al-Kursi's file
    expect(resumeTrack(stopped, 3, 200)).toBe(0); // another surah: from the start
    // From an Arabic reciter: the same verse, from its beginning
    const arabic = { surah: 2, reciter: 7, time: 1234, verse: 255 };
    expect(resumeTrack(arabic, 2, 286)).toBe(254);
    expect(resumeStartSeconds(arabic, 2, 9001, [])).toBe(0);
  });

  it('formats a place in the recitation', () => {
    expect(formatDuration(37.6)).toBe('0:37');
    expect(formatDuration(125)).toBe('2:05');
    expect(formatDuration(6133)).toBe('1:42:13');
  });
});
