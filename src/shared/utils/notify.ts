/**
 * Shows a system notification if permission was granted. Android browsers throw
 * "Illegal constructor" for `new Notification()`, so the service worker is used
 * whenever one is active, with the page-level constructor as the fallback.
 */
export function showNotification(title: string, options: NotificationOptions = {}): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const fallback = () => {
    try {
      new Notification(title, options);
    } catch (err) {
      console.warn('Notification unavailable:', err);
    }
  };

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready
      .then((registration) => registration.showNotification(title, options))
      .catch(fallback);
  } else {
    fallback();
  }
}
