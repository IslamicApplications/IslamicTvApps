/**
 * A TV moving from the old address (isamicapps.github.io/Azan/tv/) arrives once with its
 * settings in the link (#import=…), as this site can't read the old site's storage: the
 * mosque, Azan voices, theme, Quran position and so on carry over. Imported before the app
 * so every module reads the moved settings.
 */
const PREFIX = '#import=';

export function importSettingsFromHash(hash: string, storage: Pick<Storage, 'setItem'>): number {
  if (!hash.startsWith(PREFIX)) return 0;
  let count = 0;
  try {
    const base64 = hash.slice(PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const settings = JSON.parse(new TextDecoder().decode(bytes));
    for (const [key, value] of Object.entries(settings ?? {})) {
      // Only this app's own settings
      if (key.startsWith('daily_hadith_') && typeof value === 'string') {
        storage.setItem(key, value);
        count++;
      }
    }
  } catch {}
  return count;
}

if (typeof window !== 'undefined' && window.location?.hash.startsWith(PREFIX)) {
  try {
    importSettingsFromHash(window.location.hash, window.localStorage);
  } catch {}
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
}
