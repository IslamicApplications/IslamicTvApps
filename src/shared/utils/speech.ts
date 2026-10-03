import { getUiLanguage } from '../hooks/useHadithLanguage';
/**
 * Calm and dignified speech synthesis helper for reading Hadith text.
 */
let currentUtterance: SpeechSynthesisUtterance | null = null;

export function speakHadith(
  narrator: string,
  hadithText: string,
  onStart?: () => void,
  onEnd?: () => void
): boolean {
  if (!('speechSynthesis' in window)) return false;

  stopSpeaking();

  const fullText = `${narrator ? narrator + '. ' : ''}${hadithText}`;
  const utterance = new SpeechSynthesisUtterance(fullText);
  // Some collections have no English translation; read those in Arabic
  const isArabic = /[\u0600-\u06FF]/.test(hadithText) && !/[A-Za-z]{3}/.test(hadithText);
  if (isArabic) utterance.lang = 'ar-SA';

  // Find a serene voice in the text's language if available
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = isArabic
    ? voices.find(v => v.lang.startsWith('ar'))
    : voices.find(v =>
        (v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Serena') || v.name.includes('Daniel') || v.name.includes('Oliver') || v.name.includes('Google')))
      ) || voices.find(v => v.lang.startsWith('en'));

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  utterance.rate = 0.88; // Gentle, measured cadence
  utterance.pitch = 0.98;

  utterance.onstart = () => {
    if (onStart) onStart();
  };

  utterance.onend = () => {
    currentUtterance = null;
    if (onEnd) onEnd();
  };

  utterance.onerror = () => {
    currentUtterance = null;
    if (onEnd) onEnd();
  };

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function speakDua(
  arabicText: string,
  englishTranslation: string,
  onStart?: () => void,
  onEnd?: () => void
): boolean {
  if (!('speechSynthesis' in window)) return false;

  stopSpeaking();

  const voices = window.speechSynthesis.getVoices();
  const arabicVoice = voices.find(v => v.lang.startsWith('ar'));
  const englishVoice = voices.find(v =>
    (v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Serena') || v.name.includes('Daniel') || v.name.includes('Google')))
  ) || voices.find(v => v.lang.startsWith('en'));

  // If Arabic voice is available, speak Arabic then English translation
  if (arabicVoice) {
    const arUtterance = new SpeechSynthesisUtterance(arabicText);
    arUtterance.voice = arabicVoice;
    arUtterance.lang = 'ar-SA';
    arUtterance.rate = 0.85;

    const enUtterance = new SpeechSynthesisUtterance(englishTranslation);
    if (englishVoice) enUtterance.voice = englishVoice;
    enUtterance.rate = 0.9;

    arUtterance.onstart = () => {
      if (onStart) onStart();
    };

    const finish = () => {
      currentUtterance = null;
      if (onEnd) onEnd();
    };
    // In the Arabic interface the Arabic is enough; otherwise the English follows
    arUtterance.onend = () => {
      if (getUiLanguage() === 'ar' || !englishTranslation.trim()) finish();
      else window.speechSynthesis.speak(enUtterance);
    };
    arUtterance.onerror = finish;

    enUtterance.onend = () => {
      currentUtterance = null;
      if (onEnd) onEnd();
    };

    enUtterance.onerror = () => {
      currentUtterance = null;
      if (onEnd) onEnd();
    };

    currentUtterance = arUtterance;
    window.speechSynthesis.speak(arUtterance);
    return true;
  } else {
    // Speak English translation directly with introductory phrase
    const enText = `${arabicText ? 'Du\'a: ' : ''}${englishTranslation}`;
    const enUtterance = new SpeechSynthesisUtterance(enText);
    if (englishVoice) enUtterance.voice = englishVoice;
    enUtterance.rate = 0.9;

    enUtterance.onstart = () => {
      if (onStart) onStart();
    };

    enUtterance.onend = () => {
      currentUtterance = null;
      if (onEnd) onEnd();
    };

    enUtterance.onerror = () => {
      currentUtterance = null;
      if (onEnd) onEnd();
    };

    currentUtterance = enUtterance;
    window.speechSynthesis.speak(enUtterance);
    return true;
  }
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;
}

export function isSpeaking(): boolean {
  if (!('speechSynthesis' in window)) return false;
  return window.speechSynthesis.speaking;
}
