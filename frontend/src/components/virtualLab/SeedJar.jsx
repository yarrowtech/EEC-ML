import React from 'react';

// 2D jar for the Seed Germination simulation: cotton, water level, and the seed
// at growth stage 0–7 (0 seed · 1 swollen · 2 coat splits · 3 small root ·
// 4 longer root · 5 shoot appears · 6 seedling grows · 7 first leaves).
const SeedJar = ({ stage = 0, water = 1, light = true, size = 150, label }) => {
  const shoot = light ? '#16a34a' : '#bef264'; // no light → pale shoot
  const leaf = light ? '#22c55e' : '#d9f99d';
  const seedScale = stage >= 1 ? 1.15 : 1;
  const waterTop = water === 0 ? 150 : water === 1 ? 128 : 78; // y of water surface
  const rootLen = stage >= 4 ? 30 : stage >= 3 ? 14 : 0;
  const shootLen = stage >= 6 ? 46 : stage >= 5 ? 20 : 0;

  return (
    <svg viewBox="0 0 120 170" width={size} height={(size * 170) / 120} role="img" aria-label={label || `Jar at growth stage ${stage}`}>
      {/* light glow */}
      {light && <circle cx="104" cy="14" r="9" fill="#fde047" opacity="0.9" />}
      {/* jar glass */}
      <path d="M22 30 h76 v118 a14 14 0 0 1 -14 14 h-48 a14 14 0 0 1 -14 -14 z" fill="#f0f9ff" stroke="#94a3b8" strokeWidth="2" />
      <rect x="18" y="22" width="84" height="10" rx="3" fill="#cbd5e1" />
      {/* water */}
      {water > 0 && (
        <path d={`M24 ${waterTop} h72 v${148 - waterTop} a12 12 0 0 1 -12 12 h-48 a12 12 0 0 1 -12 -12 z`} fill={water === 2 ? '#7dd3fc' : '#bae6fd'} opacity="0.75" />
      )}
      {/* cotton */}
      <path d="M26 138 q8 -10 16 0 q8 -10 16 0 q8 -10 16 0 q8 -10 16 0 v20 h-64 z" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.5" />

      {/* root */}
      {rootLen > 0 && (
        <path d={`M60 128 q-3 ${rootLen / 2} 1 ${rootLen}`} stroke="#d6a77a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      )}
      {stage >= 4 && <path d="M60 140 l-6 6 M61 148 l6 5" stroke="#d6a77a" strokeWidth="1.4" strokeLinecap="round" />}

      {/* shoot */}
      {shootLen > 0 && (
        <path d={`M60 120 q4 -${shootLen / 2} 0 -${shootLen}`} stroke={shoot} strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {stage >= 7 && (
        <>
          <path d={`M60 ${120 - shootLen} q-14 -6 -18 -16 q12 2 18 16`} fill={leaf} />
          <path d={`M60 ${120 - shootLen} q14 -6 18 -16 q-12 2 -18 16`} fill={leaf} />
        </>
      )}

      {/* seed */}
      <g transform={`translate(60 124) scale(${seedScale})`}>
        <ellipse cx="0" cy="0" rx="10" ry="7" fill="#a16207" />
        <ellipse cx="-3" cy="-2" rx="4" ry="2" fill="#ca8a04" opacity="0.7" />
        {stage >= 2 && <path d="M-6 -5 l4 4 l-3 4 l4 4" stroke="#fef3c7" strokeWidth="1.3" fill="none" />}
      </g>
    </svg>
  );
};

export default SeedJar;
