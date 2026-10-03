import React, { useState, useEffect } from 'react';

// The TV UI is laid out on a fixed 1080px-tall canvas and scaled to the screen,
// so it looks identical whether the TV reports 960x540, 1920x1080 or 3840x2160.
const BASE_HEIGHT = 1080;
// Canvas width follows the screen's aspect ratio within these bounds
// (4:3 up to 21:9), so there are no black bars on common TVs.
const MIN_WIDTH = 1440;
const MAX_WIDTH = 2560;

function computeStage() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round((vw / vh) * BASE_HEIGHT)));
  const scale = Math.min(vw / width, vh / BASE_HEIGHT);
  return { width, scale };
}

export const TvStage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [{ width, scale }, setStage] = useState(computeStage);

  useEffect(() => {
    const update = () => setStage(computeStage());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-(--s0)">
      <div
        className="tv-stage absolute left-1/2 top-1/2 overflow-hidden"
        style={{
          width,
          height: BASE_HEIGHT,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center'
        }}
      >
        {children}
      </div>
    </div>
  );
};
