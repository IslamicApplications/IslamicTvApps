/** Running inside the Android TV app (android/), which adds this to its user agent. */
export const IN_ANDROID_APP = typeof navigator !== 'undefined' && /\bIslamicTvApp\//.test(navigator.userAgent);
