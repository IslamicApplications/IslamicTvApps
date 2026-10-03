import React from 'react';

interface IslamicPatternProps {
  opacity?: number; // 0 to 100
  className?: string;
  patternType?: 'girih-star' | 'arabesque-lattice' | 'rosette';
  /** Any CSS colour; the theme's pattern colour by default */
  color?: string;
}

export const IslamicPattern: React.FC<IslamicPatternProps> = ({
  opacity = 20,
  className = '',
  patternType = 'girih-star',
  color = 'var(--pattern)'
}) => {
  const normOpacity = Math.max(0, Math.min(100, opacity)) / 100;

  if (patternType === 'arabesque-lattice') {
    return (
      <div
        className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
        style={{ opacity: normOpacity, color }}
        aria-hidden="true"
      >
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
          <defs>
            <pattern id="arabesque-lattice" width="60" height="60" patternUnits="userSpaceOnUse">
              <path
                d="M 30,0 L 60,30 L 30,60 L 0,30 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.75"
                strokeOpacity="0.5"
              />
              <circle cx="30" cy="30" r="14" fill="none" stroke="currentColor" strokeWidth="0.6" strokeOpacity="0.6" />
              <circle cx="0" cy="0" r="10" fill="none" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.4" />
              <circle cx="60" cy="0" r="10" fill="none" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.4" />
              <circle cx="0" cy="60" r="10" fill="none" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.4" />
              <circle cx="60" cy="60" r="10" fill="none" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.4" />
              <path
                d="M 30,16 L 30,44 M 16,30 L 44,30"
                stroke="currentColor"
                strokeWidth="0.5"
                strokeOpacity="0.4"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#arabesque-lattice)" />
        </svg>
      </div>
    );
  }

  // Default: Authentic 8-pointed star Girih pattern
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ opacity: normOpacity, color }}
      aria-hidden="true"
    >
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <defs>
          <pattern id="girih-star" width="80" height="80" patternUnits="userSpaceOnUse">
            {/* 8-pointed central star */}
            <path
              d="M 40,16 L 47,29 L 61,22 L 54,36 L 68,40 L 54,44 L 61,58 L 47,51 L 40,64 L 33,51 L 19,58 L 26,44 L 12,40 L 26,36 L 19,22 L 33,29 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.9"
              strokeOpacity="0.75"
            />
            {/* Outer interlacing polygons */}
            <path
              d="M 0,0 L 20,20 M 60,20 L 80,0 M 80,80 L 60,60 M 20,60 L 0,80"
              stroke="currentColor"
              strokeWidth="0.8"
              strokeOpacity="0.45"
            />
            <path
              d="M 40,0 L 40,16 M 40,64 L 40,80 M 0,40 L 12,40 M 68,40 L 80,40"
              stroke="currentColor"
              strokeWidth="0.75"
              strokeOpacity="0.4"
            />
            <circle cx="40" cy="40" r="6" fill="none" stroke="currentColor" strokeWidth="0.6" strokeOpacity="0.5" />
            <circle cx="0" cy="0" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.3" />
            <circle cx="80" cy="0" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.3" />
            <circle cx="0" cy="80" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.3" />
            <circle cx="80" cy="80" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#girih-star)" />
      </svg>
    </div>
  );
};

export const IslamicCornerOrnament: React.FC<{ color?: string; className?: string }> = ({
  color = 'var(--pattern)',
  className = ''
}) => (
  <svg
    viewBox="0 0 50 50"
    className={`w-8 h-8 pointer-events-none opacity-40 ${className}`}
    style={{ color }}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M 5,5 L 45,5 C 45,25 25,45 5,45 Z" stroke="currentColor" strokeWidth="1" fill="none" />
    <path d="M 10,10 L 35,10 C 35,22 22,35 10,35 Z" stroke="currentColor" strokeWidth="0.75" fill="none" />
    <circle cx="15" cy="15" r="3" fill="currentColor" fillOpacity="0.6" />
    <line x1="5" y1="5" x2="25" y2="25" stroke="currentColor" strokeWidth="0.5" />
  </svg>
);
