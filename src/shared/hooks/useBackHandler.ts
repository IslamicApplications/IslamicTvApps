import { useEffect, useRef, useState } from 'react';

/**
 * The remote's Back for screens that open by themselves (the Azan popup, the Iqamah
 * countdown and the prayer). Menus and the Quran have history entries, which Back steps
 * through; these have none, so the Android app first calls window.tvBack(), which closes
 * the topmost of them. With nothing open, see confirmLeave.
 */
export const BACK_PRIORITY = { prayerScreen: 1, azanPopup: 2 } as const;

type BackHandler = { priority: number; onBack: () => void };
const handlers = new Set<BackHandler>();

/** Closes the topmost screen that has a Back handler; false if none is open. */
export function handleBack(): boolean {
  let top: BackHandler | null = null;
  for (const handler of handlers) if (!top || handler.priority >= top.priority) top = handler;
  if (!top) return false;
  top.onBack();
  return true;
}

/** How long "Press Back again to leave" stays up; a second Back within it leaves the app */
const LEAVE_HINT_MS = 3000;
let leaveHintUntil = 0;
const leaveHintListeners = new Set<(shown: boolean) => void>();

/**
 * Back on the prayer times (nothing left to close). Google's TV guidelines want Back to
 * lead to the home screen, but one stray press shouldn't take the prayer times off a
 * mosque's screen: the first press shows a note, a second one within 3 seconds leaves.
 * True when the app should leave now.
 */
export function confirmLeave(now: number = Date.now()): boolean {
  if (now < leaveHintUntil) {
    leaveHintUntil = 0;
    leaveHintListeners.forEach((listener) => listener(false));
    return true;
  }
  leaveHintUntil = now + LEAVE_HINT_MS;
  leaveHintListeners.forEach((listener) => listener(true));
  setTimeout(() => {
    if (Date.now() >= leaveHintUntil) leaveHintListeners.forEach((listener) => listener(false));
  }, LEAVE_HINT_MS);
  return false;
}

/** Whether "Press Back again to leave" is showing */
export function useLeaveHint(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    leaveHintListeners.add(setShown);
    return () => {
      leaveHintListeners.delete(setShown);
    };
  }, []);
  return shown;
}

if (typeof window !== 'undefined') {
  const tv = window as unknown as { tvBack: () => boolean; tvLeave: () => boolean };
  tv.tvBack = handleBack;
  tv.tvLeave = () => confirmLeave();
}

/** While `active`, Back calls `onBack` (the highest priority open screen wins). */
export function useBackHandler(active: boolean, priority: number, onBack: () => void): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  useEffect(() => {
    if (!active) return;
    const handler = { priority, onBack: () => onBackRef.current() };
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  }, [active, priority]);
}
