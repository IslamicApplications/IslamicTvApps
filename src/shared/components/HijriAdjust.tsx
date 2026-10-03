import React, { useEffect, useState } from 'react';
import { getHijriAdjustment, setHijriAdjustment, HIJRI_ADJUST_EVENT } from '../utils/hijri';
import { useI18n } from '../i18n';

/** −1 / 0 / +1 day correction to the Hijri date, for when the local moonsighting differs from Awqat. */
export const HijriAdjust: React.FC<{ size?: 'sm' | 'tv' }> = ({ size = 'sm' }) => {
  const { t } = useI18n();
  const [days, setDays] = useState(getHijriAdjustment);
  useEffect(() => {
    const sync = () => setDays(getHijriAdjustment());
    window.addEventListener(HIJRI_ADJUST_EVENT, sync);
    return () => window.removeEventListener(HIJRI_ADJUST_EVENT, sync);
  }, []);
  const button = size === 'tv' ? 'px-6 py-3 rounded-2xl text-[24px]' : 'px-3 py-1.5 rounded-lg text-xs';

  return (
    <div className={`flex items-center gap-2 ${size === 'tv' ? 'text-[22px]' : 'text-xs'} text-neutral-300`}>
      <span>{t('Hijri date adjustment')}</span>
      {[-1, 0, 1].map((n) => (
        <button
          key={n}
          onClick={() => setHijriAdjustment(n)}
          aria-pressed={days === n}
          className={`${button} font-bold transition cursor-pointer ${
            days === n ? 'bg-amber-500 text-neutral-950' : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
        >
          {n === 0 ? t('As Awqat') : t(n > 0 ? '+{n} day' : '{n} day', { n })}
        </button>
      ))}
    </div>
  );
};
