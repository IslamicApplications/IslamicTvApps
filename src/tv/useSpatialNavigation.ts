import { useEffect } from 'react';

const FOCUSABLE = 'button:not([disabled]), a[href], input, select, [tabindex]:not([tabindex="-1"])';

type Direction = 'up' | 'down' | 'left' | 'right';

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right'
};

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

function findNext(current: HTMLElement, candidates: HTMLElement[], dir: Direction): HTMLElement | null {
  const from = current.getBoundingClientRect();
  const fromX = from.left + from.width / 2;
  const fromY = from.top + from.height / 2;

  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of candidates) {
    if (el === current) continue;
    const to = el.getBoundingClientRect();
    const dx = to.left + to.width / 2 - fromX;
    const dy = to.top + to.height / 2 - fromY;

    // Distance along the pressed direction must be positive; sideways drift is penalised
    const primary = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    const secondary = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (primary <= 1) continue;

    const score = primary + secondary * 2.5;
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
      const dir = KEY_DIRECTIONS[e.key];
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
