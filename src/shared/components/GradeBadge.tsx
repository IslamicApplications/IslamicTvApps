import React from 'react';
import { CircleCheck, CircleAlert, CircleHelp } from 'lucide-react';
import { Hadith } from '../types/hadith';
import { describeGrade } from '../utils/hadithLibrary';
import { useI18n } from '../i18n';

const TONES = {
  sahih: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
  hasan: 'bg-sky-500/15 border-sky-500/40 text-sky-300',
  daif: 'bg-orange-500/15 border-orange-500/40 text-orange-300',
  fabricated: 'bg-rose-500/20 border-rose-500/50 text-rose-300',
  other: 'bg-white/10 border-white/20 text-neutral-300',
  none: 'bg-white/5 border-white/15 text-neutral-400'
};

interface GradeBadgeProps {
  hadith: Hadith;
  /** 'tv' uses the 1920-wide TV type scale */
  size?: 'sm' | 'tv';
  /** Also show who graded it ("Al-Albani") */
  showGrader?: boolean;
}

/** Authenticity grade of a Hadith (Sahih, Hasan, Daʻif, Mawduʻ…), coloured by strength. */
export const GradeBadge: React.FC<GradeBadgeProps> = ({ hadith, size = 'sm', showGrader = false }) => {
  const { language } = useI18n();
  const grade = describeGrade(hadith, language);
  const Icon =
    grade.category === 'sahih' || grade.category === 'hasan'
      ? CircleCheck
      : grade.category === 'none' || grade.category === 'other'
        ? CircleHelp
        : CircleAlert;
  const sizing =
    size === 'tv'
      ? 'gap-2.5 px-4 py-1.5 rounded-xl text-[22px] [&_svg]:w-6 [&_svg]:h-6'
      : 'gap-1.5 px-2.5 py-0.5 rounded-full text-xs [&_svg]:w-3.5 [&_svg]:h-3.5';

  return (
    <span
      title={`${grade.label} — ${grade.by}`}
      className={`inline-flex items-center border font-sans font-semibold whitespace-nowrap ${sizing} ${TONES[grade.category]}`}
    >
      <Icon />
      <span>{grade.label}</span>
      {showGrader && grade.category !== 'none' && (
        <span className="font-normal opacity-75">· {grade.by.replace(/^(Graded by |حكم )/, '')}</span>
      )}
    </span>
  );
};
