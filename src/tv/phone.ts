import { useEffect, useState } from 'react';
import { IN_ANDROID_APP } from '../shared/utils/androidApp';

/**
 * A phone: a touch screen whose shorter side is under 500 CSS px. A TV has no touch
 * screen (and reports 540 px or more), a tablet's shorter side is 744 px or more.
 */
export function isPhoneScreen(width: number, height: number, touch: boolean): boolean {
  return touch && Math.min(width, height) < 500;
}

function detectPhone(): boolean {
  if (IN_ANDROID_APP || typeof window === 'undefined') return false;
  const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return isPhoneScreen(window.innerWidth, window.innerHeight, touch);
}

/**
 * The menus and full-screen overlays are drawn for the 1920x1080 TV canvas; on a phone
 * they are laid out this wide and zoomed to the screen's width (about 0.55 on a phone).
 */
export const PHONE_MENU_WIDTH = 720;

export function phoneMenuZoom(screenWidth: number): number {
  return Math.min(1, Math.round((screenWidth / PHONE_MENU_WIDTH) * 1000) / 1000);
}

/** Whether to show the phone layout, and the screen width, kept up to date on resize. */
export function usePhone(): { phone: boolean; width: number } {
  const read = () => ({ phone: detectPhone(), width: typeof window === 'undefined' ? 0 : window.innerWidth });
  const [state, setState] = useState(read);
  useEffect(() => {
    const update = () => setState(read());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return state;
}
