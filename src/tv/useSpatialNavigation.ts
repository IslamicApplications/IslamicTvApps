import { useEffect } from 'react';

const FOCUSABLE = 'button:not([disabled]), a[href], input, select, [tabindex]:not([tabindex="-1"])';

export type Direction = 'up' | 'down' | 'left' | 'right';

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  // Older TV browsers name them without "Arrow"
  Up: 'up',
  Down: 'down',
  Left: 'left',
  Right: 'right'
};

// Some TV browsers send only the key code ("Unidentified" as the key)
const KEY_CODE_DIRECTIONS: Record<number, Direction> = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };

export function keyDirection(e: Pick<KeyboardEvent, 'key' | 'keyCode'>): Direction | undefined {
  return KEY_DIRECTIONS[e.key] ?? KEY_CODE_DIRECTIONS[e.keyCode];
}

function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  // `invisible` (visibility: hidden) keeps its size but can't take focus
  return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

/** Focusable elements in the topmost open dialog, or the whole page if none is open. */
function getCandidates(): HTMLElement[] {
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
  const scope: ParentNode = dialogs.length > 0 ? dialogs[dialogs.length - 1] : document;
  return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible);
}

export type Rect = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;

/**
 * How far `to` is from `from` when moving in `dir` (lower is closer), or null if it isn't
 * in that direction. Measured edge to edge, not centre to centre: a wide button right
 * above a small one counts as straight above, even though its centre is off to one side.
 */
export function directionScore(from: Rect, to: Rect, dir: Direction): number | null {
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const centreAhead = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
  if (centreAhead <= 1) return null;

  // Gap between the facing edges (0 when they touch or overlap)
  const ahead = Math.max(0,
    dir === 'left' ? from.left - to.right
      : dir === 'right' ? to.left - from.right
      : dir === 'up' ? from.top - to.bottom
      : to.top - from.bottom);
  // Sideways gap: 0 when the two share a row (left/right) or a column (up/down)
  const sideways = dir === 'left' || dir === 'right'
    ? Math.max(0, to.top - from.bottom, from.top - to.bottom)
    : Math.max(0, to.left - from.right, from.left - to.right);
  // Among equally close ones, the one most in line with the focused control
  const offCentre = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
  return ahead + sideways * 2.5 + offCentre * 0.01;
}

function findNext(current: HTMLElement, candidates: HTMLElement[], dir: Direction): HTMLElement | null {
  const from = current.getBoundingClientRect();

  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of candidates) {
    if (el === current) continue;
    const score = directionScore(from, el.getBoundingClientRect(), dir);
    if (score === null) continue;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

/**
 * TV remote (D-pad) navigation: arrow keys move focus to the nearest focusable
 * element in that direction; OK/Enter activates it natively.
 */
export function useSpatialNavigation(): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const dir = keyDirection(e);
      if (!dir) return;

      const target = e.target as HTMLElement | null;
      // Left/right move the cursor in a text box; up/down still leave it
      if (target?.tagName === 'SELECT') return;
      if (target?.tagName === 'INPUT' && (dir === 'left' || dir === 'right')) return;

      const candidates = getCandidates();
      if (candidates.length === 0) return;
      e.preventDefault();

      const current = document.activeElement as HTMLElement | null;
      const next = current && candidates.includes(current)
        ? findNext(current, candidates, dir)
        : candidates[0];

      if (next) {
        next.focus();
        next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
