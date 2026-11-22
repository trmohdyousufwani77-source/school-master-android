import React from 'react';

interface SchoolEmblemProps {
  size?: number;
  className?: string;
  showMotto?: boolean;
}

export const SchoolEmblem: React.FC<SchoolEmblemProps> = ({
  size = 80,
  className = '',
  showMotto = false,
}) => {
  return (
    <div className={`inline-flex flex-col items-center justify-center shrink-0 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Government Middle School Pamposh Colony Official Crest: Open Book, Rising Sun, Pen Nib, and Green Laurel Branches"
      >
        <defs>
          <linearGradient id="gmsNavyGrad" x1="15" y1="10" x2="105" y2="110" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0f294a" />
            <stop offset="100%" stopColor="#172554" />
          </linearGradient>
          <linearGradient id="gmsGoldGrad" x1="20" y1="15" x2="100" y2="105" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <linearGradient id="gmsSunGrad" x1="60" y1="22" x2="60" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>

        {/* Outer Navy & Golden-Yellow Seal */}
        <circle cx="60" cy="60" r="56" fill="url(#gmsNavyGrad)" stroke="url(#gmsGoldGrad)" strokeWidth="4" />
        <circle cx="60" cy="60" r="50" fill="none" stroke="#fef3c7" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />

        {/* Green Laurel Branches (Left & Right) */}
        <g stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" fill="#16a34a">
          {/* Left Branch */}
          <path d="M54 96 C34 90 22 72 24 46" fill="none" stroke="#4ade80" strokeWidth="2" />
          <ellipse cx="23" cy="54" rx="4.5" ry="2.2" transform="rotate(-35 23 54)" />
          <ellipse cx="25" cy="65" rx="4.5" ry="2.2" transform="rotate(-20 25 65)" />
          <ellipse cx="30" cy="76" rx="4.8" ry="2.2" transform="rotate(0 30 76)" />
          <ellipse cx="38" cy="85" rx="4.8" ry="2.2" transform="rotate(20 38 85)" />
          <ellipse cx="47" cy="92" rx="4.5" ry="2.1" transform="rotate(35 47 92)" />

          {/* Right Branch */}
          <path d="M66 96 C86 90 98 72 96 46" fill="none" stroke="#4ade80" strokeWidth="2" />
          <ellipse cx="97" cy="54" rx="4.5" ry="2.2" transform="rotate(35 97 54)" />
          <ellipse cx="95" cy="65" rx="4.5" ry="2.2" transform="rotate(20 95 65)" />
          <ellipse cx="90" cy="76" rx="4.8" ry="2.2" transform="rotate(0 90 76)" />
          <ellipse cx="82" cy="85" rx="4.8" ry="2.2" transform="rotate(-20 82 85)" />
          <ellipse cx="73" cy="92" rx="4.5" ry="2.1" transform="rotate(-35 73 92)" />
        </g>

        {/* Rising Sun with Golden Rays */}
        <g stroke="#fde047" strokeWidth="2" strokeLinecap="round">
          <line x1="60" y1="19" x2="60" y2="27" />
          <line x1="44" y1="24" x2="48" y2="31" />
          <line x1="76" y1="24" x2="72" y2="31" />
          <line x1="34" y1="35" x2="41" y2="39" />
          <line x1="86" y1="35" x2="79" y2="39" />
        </g>
        <path d="M44 50 A16 16 0 0 1 76 50 Z" fill="url(#gmsSunGrad)" />

        {/* Classic Fountain Pen Nib */}
        <path
          d="M60 29 L67 45 L63.5 55 L56.5 55 L53 45 Z"
          fill="#ffffff"
          stroke="#f59e0b"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <line x1="60" y1="29" x2="60" y2="43" stroke="#0f294a" strokeWidth="1.4" />
        <circle cx="60" cy="44" r="1.8" fill="#0f294a" />

        {/* Open Book (White & Golden Spine) */}
        <path
          d="M32 58 C42 54 52 55 60 61 C68 55 78 54 88 58 L88 79 C78 75 68 76 60 82 C52 76 42 75 32 79 Z"
          fill="#ffffff"
          stroke="#fbbf24"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <line x1="60" y1="61" x2="60" y2="82" stroke="#1e3a8a" strokeWidth="1.8" />
        <line x1="38" y1="64" x2="54" y2="66" stroke="#94a3b8" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="38" y1="69" x2="54" y2="71" stroke="#94a3b8" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="66" y1="66" x2="82" y2="64" stroke="#94a3b8" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="66" y1="71" x2="82" y2="69" stroke="#94a3b8" strokeWidth="1.3" strokeLinecap="round" />

        {/* Bottom Motto Scroll */}
        <rect x="26" y="88" width="68" height="14" rx="4" fill="#fbbf24" stroke="#0f294a" strokeWidth="1.5" />
        <text
          x="60"
          y="97.5"
          textAnchor="middle"
          fill="#0f172a"
          fontSize="6.4"
          fontWeight="800"
          fontFamily="Plus Jakarta Sans, sans-serif"
          letterSpacing="0.5"
        >
          LEARN • GROW • EXCEL
        </text>
      </svg>
      {showMotto && (
        <span className="mt-1.5 text-[10px] font-extrabold tracking-widest text-amber-300 uppercase">
          Learn • Grow • Excel
        </span>
      )}
    </div>
  );
};
