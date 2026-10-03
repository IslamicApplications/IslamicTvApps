import { useEffect, useState } from 'react';
import { SITE_ROOT } from '../utils/siteRoot';

const CHECK_EVERY_MS = 15 * 60 * 1000;

/**
 * A TV can run the app for weeks without reloading, so it would keep an old version.
 * Every 15 minutes this checks version.json (written by each build); when a newer build
 * is deployed it reloads, but only once `safeToReload` (no Azan, prayer or Quran).
 */
export function useReloadOnUpdate(enabled: boolean, safeToReload: boolean): void {
  const [updateWaiting, setUpdateWaiting] = useState(false);

  useEffect(() => {
    if (!enabled || !import.meta.env.PROD || typeof __BUILD_ID__ === 'undefined') return;
    const check = async () => {
      try {
        const res = await fetch(`${SITE_ROOT}version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const { build } = await res.json();
        if (typeof build === 'string' && build !== __BUILD_ID__) setUpdateWaiting(true);
      } catch {}
    };
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, [enabled]);

  // Quiet for a few seconds first: Stop and closing a dialog also step back in the
  // history, and that navigation would cancel a reload made at the same moment
  useEffect(() => {
    if (!updateWaiting || !safeToReload) return;
    const timer = setTimeout(() => window.location.reload(), 5000);
    return () => clearTimeout(timer);
  }, [updateWaiting, safeToReload]);
}
