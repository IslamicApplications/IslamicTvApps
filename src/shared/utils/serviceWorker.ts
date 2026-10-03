/** Registers the offline service worker at the site root (production only). */
export function registerServiceWorker(swUrl: string, scope?: string): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl, scope ? { scope } : undefined).catch((err) => {
      console.log('ServiceWorker registration skipped:', err);
    });
  });
}
