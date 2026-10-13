import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ScrollArrowsProps {
  /** The scrolling list the arrows page through */
  listRef: React.RefObject<HTMLElement | null>;
  t: (text: string) => string;
}

/**
 * Big up/down buttons beside a long list (the mosque picker, the surahs) that page it most
 * of a screen at a time: Right from the list then OK on the remote, or a click where the
 * TV has a pointer.
 */
export const ScrollArrows: React.FC<ScrollArrowsProps> = ({ listRef, t }) => (
  <div className="flex flex-col justify-between gap-4 p-2">
    {([['up', ChevronUp, -1], ['down', ChevronDown, 1]] as const).map(([dir, Icon, sign]) => (
      <button
        key={dir}
        onClick={() => {
          const list = listRef.current;
          list?.scrollBy({ top: sign * list.clientHeight * 0.8, behavior: 'smooth' });
        }}
        className="flex-1 min-h-[96px] px-5 flex items-center justify-center rounded-3xl bg-white/10 hover:bg-white/20 border border-white/10 text-neutral-200 cursor-pointer"
        title={t(dir === 'up' ? 'Scroll up' : 'Scroll down')}
      >
        <Icon className="w-12 h-12" />
      </button>
    ))}
  </div>
);
