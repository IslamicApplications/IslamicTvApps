import React from 'react';
import { useI18n } from '../i18n';

/** Crescent and a hanging lantern, shown during Ramadan (in the theme's accent gold). */
export const RamadanAccent: React.FC<{ size?: 'sm' | 'tv'; className?: string }> = ({ size = 'sm', className = '' }) => {
  const { t } = useI18n();
  const px = size === 'tv' ? 76 : 30;
  return (
    <svg
      viewBox="0 0 64 64"
      width={px}
      height={px}
      role="img"
      aria-label={t('Ramadan Mubarak')}
      className={`shrink-0 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.35)] ${className}`}
    >
      <title>{t('Ramadan Mubarak')}</title>
      {/* Crescent */}
      <path d="M30 6a20 20 0 1 0 17 30A16 16 0 1 1 30 6z" fill="currentColor" opacity="0.9" />
      <path d="M44 9l1.4 3.1 3.4.3-2.6 2.2.8 3.3-3-1.8-3 1.8.8-3.3-2.6-2.2 3.4-.3z" fill="currentColor" />
      {/* Lantern on its chain */}
      <line x1="50" y1="20" x2="50" y2="31" stroke="currentColor" strokeWidth="1.2" />
      <path d="M46.5 31h7l-1 2.5h-5z" fill="currentColor" />
      <path d="M46 33.5h8l1.5 4-1.5 10h-8l-1.5-10z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M50 35.5c1.8 2.5 1.8 5 0 7.5-1.8-2.5-1.8-5 0-7.5z" fill="currentColor" opacity="0.75" />
      <path d="M46.5 47.5h7l-1 2.5h-5z" fill="currentColor" />
    </svg>
  );
};
