import { useEffect, useRef } from 'react';

/**
 * The remote's Back for screens that open by themselves (the Azan popup, the Iqamah
 * countdown and the prayer). Menus and the Quran have history entries, which Back steps
 * through; these have none, so the Android app first calls window.tvBack(), which closes
 * the topmost of them. With nothing open Back does nothing, so a stray press can't take
 * the prayer times off the screen.
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

if (typeof window !== 'undefined') (window as unknown as { tvBack: () => boolean }).tvBack = handleBack;

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
