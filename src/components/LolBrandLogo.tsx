import React from 'react';

interface LolBrandLogoProps {
  variant?: 'full' | 'navbar' | 'badge';
  className?: string;
}

/**
 * Faithful vector recreation of the official "LOL: LEHENGA ON LEASE By Sanjeevani" logo:
 * - Left 'L': Festive Terracotta Orange (#F07E3E) with maroon (#5A0805) 4-petal floral column & arch lattice foot
 * - Center 'O': Deep Chocolate Brown (#381305) ring with twirling orange-and-white patterned lehenga illustration
 * - Right 'L': Festive Terracotta Orange (#F07E3E) with two hanging maroon temple diyas on beaded chains
 * - Wordmark: "LEHENGA ON LEASE" with orange L, O, L and chocolate brown letters
 * - Signature: "By Sanjeevani" in flowing script underneath LEASE
 */
export const LolBrandLogo: React.FC<LolBrandLogoProps> = ({
  variant = 'full',
  className = '',
}) => {
  if (variant === 'badge') {
    return (
      <div
        className={`inline-flex items-center justify-center bg-white/95 backdrop-blur-md rounded-xl border border-[#381305]/20 shadow-sm px-2.5 py-1.5 ${className}`}
      >
        <LolGraphicSvg className="w-20 h-11" />
      </div>
    );
  }

  if (variant === 'navbar') {
    return (
      <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
        <div className="bg-white rounded-xl border border-[#381305]/15 shadow-2xs px-2 py-1 shrink-0">
          <LolGraphicSvg className="w-16 sm:w-20 h-9 sm:h-11" />
        </div>
        <div className="flex flex-col justify-center leading-none">
          <div className="font-syne font-extrabold text-sm sm:text-lg tracking-tight text-[#381305]">
            <span className="text-[#F07E3E]">L</span>EHENGA{' '}
            <span className="text-[#F07E3E]">O</span>N{' '}
            <span className="text-[#F07E3E]">L</span>EASE
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="text-base sm:text-lg text-[#23120B] leading-none"
              style={{ fontFamily: "'Great Vibes', cursive" }}
            >
              By Sanjeevani
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex flex-col items-center justify-center select-none ${className}`}
    >
      <LolGraphicSvg className="w-56 sm:w-72 md:w-80 h-auto" />
      <div className="mt-1 text-center">
        <div className="font-syne font-extrabold text-lg sm:text-2xl tracking-tight leading-none text-[#381305]">
          <span className="text-[#F07E3E]">L</span>EHENGA{' '}
          <span className="text-[#F07E3E]">O</span>N{' '}
          <span className="text-[#F07E3E]">L</span>EASE
        </div>
        <div className="w-full flex justify-end pr-1 -mt-1">
          <span
            className="text-xl sm:text-2xl text-[#1A0B05] leading-none"
            style={{ fontFamily: "'Great Vibes', cursive" }}
          >
            By Sanjeevani
          </span>
        </div>
      </div>
    </div>
  );
};

const LolGraphicSvg: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <svg
      viewBox="0 0 520 235"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="LOL: Lehenga On Lease By Sanjeevani Logo"
    >
      <defs>
        <clipPath id="leftLClip">
          <path d="M18 15 H76 V174 H162 V222 H18 Z" />
        </clipPath>
        <clipPath id="rightLClip">
          <path d="M362 15 H420 V174 H504 V222 H362 Z" />
        </clipPath>
        <linearGradient id="lehengaOrangeGrad" x1="180" y1="75" x2="340" y2="225" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F58242" />
          <stop offset="55%" stopColor="#EB6B2A" />
          <stop offset="100%" stopColor="#D95618" />
        </linearGradient>
      </defs>

      {/* LEFT "L" — Festive Orange with Maroon 4-Petal Floral & Arch Lattice */}
      <g clipPath="url(#leftLClip)">
        <path d="M18 15 H76 V174 H162 V222 H18 Z" fill="#F07E3E" />
        <line x1="47" y1="15" x2="47" y2="222" stroke="#5A0805" strokeWidth="1.8" />
        {[42, 92, 142, 192].map((cy, idx) => (
          <g key={idx} transform={`translate(47, ${cy})`}>
            <path
              d="M0 0 C-9 -10, -9 -19, 0 -25 C9 -19, 9 -10, 0 0 Z"
              fill="#F07E3E"
              stroke="#5A0805"
              strokeWidth="2.2"
            />
            <path d="M0 -4 C-4 -10, -4 -16, 0 -20 C4 -16, 4 -10, 0 -4 Z" fill="#5A0805" />
            <path
              d="M0 0 C-9 10, -9 19, 0 25 C9 19, 9 10, 0 0 Z"
              fill="#F07E3E"
              stroke="#5A0805"
              strokeWidth="2.2"
            />
            <path d="M0 4 C-4 10, -4 16, 0 20 C4 16, 4 10, 0 4 Z" fill="#5A0805" />
            <path
              d="M0 0 C-10 -9, -19 -9, -25 0 C-19 9, -10 9, 0 0 Z"
              fill="#F07E3E"
              stroke="#5A0805"
              strokeWidth="2.2"
            />
            <path d="M-4 0 C-10 -4, -16 -4, -20 0 C-16 4, -10 4, -4 0 Z" fill="#5A0805" />
            <path
              d="M0 0 C10 -9, 19 -9, 25 0 C19 9, 10 9, 0 0 Z"
              fill="#F07E3E"
              stroke="#5A0805"
              strokeWidth="2.2"
            />
            <path d="M4 0 C10 -4, 16 -4, 20 0 C16 4, 10 4, 4 0 Z" fill="#5A0805" />
            <circle cx="-13" cy="-13" r="2.3" fill="#5A0805" />
            <circle cx="13" cy="-13" r="2.3" fill="#5A0805" />
            <circle cx="-13" cy="13" r="2.3" fill="#5A0805" />
            <circle cx="13" cy="13" r="2.3" fill="#5A0805" />
          </g>
        ))}

        {[96, 134].map((cx, i) => (
          <g key={i} transform={`translate(${cx}, 198)`}>
            <path
              d="M-18 0 C-12 -12, 12 -12, 18 0 C12 12, -12 12, -18 0 Z"
              stroke="#5A0805"
              strokeWidth="1.8"
              fill="none"
            />
            <path
              d="M-18 -16 C-12 -4, 12 -4, 18 -16"
              stroke="#5A0805"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M-18 16 C-12 4, 12 4, 18 16"
              stroke="#5A0805"
              strokeWidth="1.5"
              fill="none"
            />
            <circle cx="-21" cy="0" r="1.8" fill="#5A0805" />
            <circle cx="21" cy="0" r="1.8" fill="#5A0805" />
          </g>
        ))}
      </g>

      {/* CENTER "O" — Dark Chocolate Ring + Twirling Orange Lehenga Girl */}
      <g>
        <circle cx="260" cy="118" r="102" fill="#381305" />
        <circle cx="260" cy="118" r="46" fill="#FFFFFF" />
        <path
          d="M242 52 C233 54, 228 66, 230 78 C232 86, 240 90, 247 88 C256 86, 262 76, 259 64 C257 55, 249 51, 242 52 Z"
          fill="#1F120D"
        />
        <ellipse cx="247" cy="67" rx="6.5" ry="8" fill="#F9D4B4" />
        <path
          d="M241 58 C236 64, 234 76, 237 86"
          stroke="#1F120D"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path d="M238 82 L256 80 L261 98 L240 99 Z" fill="#1B459B" />
        <path
          d="M238 84 C228 92, 222 100, 217 104"
          stroke="#F9D4B4"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M256 82 C266 86, 274 79, 279 74"
          stroke="#F9D4B4"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M238 97
             C215 115, 188 148, 174 176
             C192 204, 226 226, 268 225
             C312 224, 348 196, 356 158
             C358 134, 336 105, 308 82
             C292 94, 274 101, 258 97 Z"
          fill="url(#lehengaOrangeGrad)"
          stroke="#C84B12"
          strokeWidth="1.5"
        />
        <path
          d="M238 82 C226 104, 220 132, 230 156 C246 146, 262 122, 258 95 Z"
          fill="#F58649"
          stroke="#FFFFFF"
          strokeWidth="1.2"
          strokeDasharray="3 2"
        />
        <path
          d="M182 172 Q265 218 352 152"
          stroke="#FFFFFF"
          strokeWidth="5"
          strokeDasharray="8 5"
          fill="none"
          opacity="0.85"
        />
        <path
          d="M192 186 Q268 228 346 168"
          stroke="#381305"
          strokeWidth="3"
          strokeDasharray="4 4"
          fill="none"
          opacity="0.65"
        />
        <path
          d="M206 198 Q270 234 334 186"
          stroke="#FFFFFF"
          strokeWidth="4"
          strokeDasharray="6 4"
          fill="none"
          opacity="0.9"
        />
        <path d="M244 99 L204 192" stroke="#C84B12" strokeWidth="1.3" opacity="0.7" />
        <path d="M250 99 L236 214" stroke="#C84B12" strokeWidth="1.3" opacity="0.7" />
        <path d="M256 99 L274 220" stroke="#C84B12" strokeWidth="1.3" opacity="0.7" />
        <path d="M262 98 L314 202" stroke="#C84B12" strokeWidth="1.3" opacity="0.7" />
        <path d="M268 96 L344 166" stroke="#C84B12" strokeWidth="1.3" opacity="0.7" />

        {[
          [222, 145],
          [246, 162],
          [272, 166],
          [298, 152],
          [318, 132],
          [260, 135],
          [284, 128],
        ].map(([mx, my], idx) => (
          <g key={idx} transform={`translate(${mx}, ${my})`}>
            <circle cx="0" cy="0" r="3.5" fill="#FFFFFF" opacity="0.9" />
            <circle cx="0" cy="0" r="1.8" fill="#F07E3E" />
          </g>
        ))}
      </g>

      {/* RIGHT "L" — Festive Orange with Two Hanging Maroon Temple Diyas */}
      <g clipPath="url(#rightLClip)">
        <path d="M362 15 H420 V174 H504 V222 H362 Z" fill="#F07E3E" />
        <g transform="translate(383, 15)">
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="92"
            stroke="#5A0805"
            strokeWidth="2.2"
            strokeDasharray="3 3"
          />
          <circle cx="0" cy="95" r="3" fill="#5A0805" />
          <path d="M-4 102 H4 L6 112 H-6 Z" fill="#5A0805" />
          <path d="M-8 112 H8 L5 117 H-5 Z" fill="#5A0805" />
          <path d="M-18 117 H18 C15 126, -15 126, -18 117 Z" fill="#5A0805" />
          <path d="M-4 123 H4 L8 130 H-8 Z" fill="#5A0805" />
          <path d="M-16 117 C-18 112, -14 110, -13 117 Z" fill="#5A0805" />
          <path d="M16 117 C18 112, 14 110, 13 117 Z" fill="#5A0805" />
        </g>

        <g transform="translate(406, 15)">
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="64"
            stroke="#5A0805"
            strokeWidth="1.8"
            strokeDasharray="2.5 2.5"
          />
          <circle cx="0" cy="67" r="2.2" fill="#5A0805" />
          <path d="M-3 72 H3 L4.5 79 H-4.5 Z" fill="#5A0805" />
          <path d="M-13 79 H13 C11 86, -11 86, -13 79 Z" fill="#5A0805" />
          <path d="M-3 84 H3 L6 89 H-6 Z" fill="#5A0805" />
          <path d="M-11 79 C-13 75, -10 74, -9 79 Z" fill="#5A0805" />
          <path d="M11 79 C13 75, 10 74, 9 79 Z" fill="#5A0805" />
        </g>
      </g>
    </svg>
  );
};
