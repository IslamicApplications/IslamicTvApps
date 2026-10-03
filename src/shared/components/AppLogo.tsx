import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: number;
  glow?: boolean;
}

export const AppLogo: React.FC<AppLogoProps> = ({ className = '', size = 40, glow = true }) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <div
          className="absolute inset-0 rounded-2xl bg-amber-500/20 blur-md pointer-events-none animate-pulse"
          style={{ width: size, height: size }}
        />
      )}
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full relative z-10 drop-shadow-md"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="logoBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#181f33" />
            <stop offset="50%" stop-color="#0a0d17" />
            <stop offset="100%" stop-color="#04060a" />
          </linearGradient>

          <linearGradient id="logoGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fff4b8" />
            <stop offset="35%" stop-color="#fbbf24" />
            <stop offset="70%" stop-color="#d97706" />
            <stop offset="100%" stop-color="#92400e" />
          </linearGradient>

          <linearGradient id="logoEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#34d399" />
            <stop offset="100%" stop-color="#059669" />
          </linearGradient>
        </defs>

        {/* Shield Container */}
        <rect
          x="2"
          y="2"
          width="96"
          height="96"
          rx="24"
          fill="url(#logoBgGrad)"
          stroke="url(#logoGold)"
          strokeWidth="2"
          strokeOpacity="0.8"
        />

        {/* Subtle 8-point geometric star in background */}
        <g stroke="url(#logoGold)" strokeWidth="0.8" strokeOpacity="0.25" fill="none">
          <rect x="24" y="24" width="52" height="52" rx="6" />
          <rect x="24" y="24" width="52" height="52" rx="6" transform="rotate(45 50 50)" />
        </g>

        {/* Mihrab Arch */}
        <path
          d="M28 80 L28 54 Q28 34 50 20 Q72 34 72 54 L72 80 Z"
          fill="#0c101c"
          stroke="url(#logoGold)"
          strokeWidth="1.5"
        />

        {/* Inner Dome */}
        <path
          d="M36 78 C36 58 50 48 50 48 C50 48 64 58 64 78 Z"
          fill="url(#logoGold)"
          opacity="0.9"
        />

        {/* Minarets Left & Right */}
        <rect x="20" y="44" width="4" height="36" rx="1" fill="url(#logoGold)" opacity="0.6" />
        <polygon points="20,44 24,44 22,38" fill="#fbbf24" opacity="0.8" />

        <rect x="76" y="44" width="4" height="36" rx="1" fill="url(#logoGold)" opacity="0.6" />
        <polygon points="76,44 80,44 78,38" fill="#fbbf24" opacity="0.8" />

        {/* Radiant Crescent Moon & Star */}
        <g transform="translate(50, 24)">
          <path
            d="M0 -7 A 6 6 0 0 0 -4 4 A 6 6 0 1 1 3 -6 A 5 5 0 0 0 0 -7 Z"
            fill="url(#logoGold)"
          />
          <polygon points="2,-1 3,0 5,1 3,2 2,4 1,2 -1,1 1,0" fill="#ffffff" />
        </g>
      </svg>
    </div>
  );
};
