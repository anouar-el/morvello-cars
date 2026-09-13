import React, { useState } from 'react';
import emblemTransp from '../assets/images/morvello_emblem_transp.png';
import newLogoTransp from '../assets/images/morvello_nouveau_logo_transp.png';
import newLogoFull from '../assets/images/morvello_nouveau_logo_1788650487314.jpg';
import rectLogoLegacy from '../assets/images/morvello_rect_logo_1788313603329.jpg';

export interface CompanyLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  customHeight?: number;
  variant?: 'full' | 'emblem' | 'icon-only' | 'rectangular' | 'vector' | 'raw-image';
  showTagline?: boolean;
  theme?: 'light' | 'dark' | 'transparent';
  transparent?: boolean;
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  className = '',
  size = 'md',
  customHeight,
  variant = 'full',
  showTagline = true,
  theme = 'transparent',
  transparent = true,
}) => {
  const [imageError, setImageError] = useState(false);

  // Dimensions map adapted for maximum legibility and visual prestige
  const dimensions = {
    xs: {
      height: 46,
      width: 48,
      iconOnlySize: 32,
      imgClass: 'h-9',
      rectHeight: 38,
      rectWidth: 180,
      titleSize: 'text-[11px]',
      taglineSize: 'text-[7px]',
      subSize: 'text-[6.5px]',
    },
    sm: {
      height: 64,
      width: 64,
      iconOnlySize: 42,
      imgClass: 'h-12',
      rectHeight: 52,
      rectWidth: 225,
      titleSize: 'text-[12.5px]',
      taglineSize: 'text-[8px]',
      subSize: 'text-[7.5px]',
    },
    md: {
      height: 84,
      width: 90,
      iconOnlySize: 56,
      imgClass: 'h-16',
      rectHeight: 64,
      rectWidth: 265,
      titleSize: 'text-[15px]',
      taglineSize: 'text-[9.5px]',
      subSize: 'text-[8.5px]',
    },
    lg: {
      height: 130,
      width: 140,
      iconOnlySize: 76,
      imgClass: 'h-28',
      rectHeight: 88,
      rectWidth: 350,
      titleSize: 'text-[18.5px]',
      taglineSize: 'text-[12px]',
      subSize: 'text-[10px]',
    },
    xl: {
      height: 180,
      width: 200,
      iconOnlySize: 96,
      imgClass: 'h-40',
      rectHeight: 120,
      rectWidth: 440,
      titleSize: 'text-[22px]',
      taglineSize: 'text-[14px]',
      subSize: 'text-[12px]',
    },
  }[size];

  // 1. EMBLEM ONLY / JUSTE LA PARTIE LOGO (100% transparent background)
  if (variant === 'emblem' || variant === 'icon-only') {
    if (!imageError && (emblemTransp || newLogoTransp)) {
      return (
        <div
          className={`inline-flex items-center justify-center select-none shrink-0 bg-transparent ${className}`}
          style={{ width: dimensions.iconOnlySize, height: dimensions.iconOnlySize }}
          aria-label="Logo Sté MORVELLO CARS - Emblème officiel transparent"
        >
          <img
            src={emblemTransp || newLogoTransp}
            alt="Sté MORVELLO CARS - Emblème officiel"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="w-full h-full object-contain filter drop-shadow-sm transition-transform hover:scale-105"
          />
        </div>
      );
    }

    return (
      <div
        className={`inline-flex items-center justify-center select-none shrink-0 bg-transparent ${className}`}
        style={{ width: dimensions.iconOnlySize, height: dimensions.iconOnlySize }}
        aria-label="Logo Sté MORVELLO CARS"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
          <defs>
            <linearGradient id="gold-grad-icon" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="35%" stopColor="#fbbf24" />
              <stop offset="70%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <linearGradient id="shield-bg-icon" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>

          {/* Outer Gold Shield */}
          <polygon
            points="50,6 88,22 88,58 50,92 12,58 12,22"
            fill="url(#shield-bg-icon)"
            stroke="url(#gold-grad-icon)"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />

          {/* Inner Shield border */}
          <polygon
            points="50,13 82,27 82,55 50,85 18,55 18,27"
            fill="#0f172a"
            stroke="url(#gold-grad-icon)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* Vintage Classic Car Silhouette */}
          <g transform="translate(18, 22) scale(0.64)">
            <path
              d="M 22,22 L 30,8 L 70,8 L 78,22 Z"
              fill="#1e293b"
              stroke="#fbbf24"
              strokeWidth="1.8"
            />
            <path
              d="M 14,24 Q 50,18 86,24 L 92,44 Q 50,48 8,44 Z"
              fill="#090d16"
              stroke="#fbbf24"
              strokeWidth="2"
            />
            <rect
              x="36"
              y="22"
              width="28"
              height="30"
              rx="4"
              fill="#1e293b"
              stroke="#f59e0b"
              strokeWidth="2"
            />
            <line x1="42" y1="26" x2="42" y2="48" stroke="#fde68a" strokeWidth="1.5" />
            <line x1="47" y1="24" x2="47" y2="50" stroke="#fde68a" strokeWidth="1.5" />
            <line x1="50" y1="24" x2="50" y2="50" stroke="#fde68a" strokeWidth="1.5" />
            <line x1="53" y1="24" x2="53" y2="50" stroke="#fde68a" strokeWidth="1.5" />
            <line x1="58" y1="26" x2="58" y2="48" stroke="#fde68a" strokeWidth="1.5" />

            <circle cx="24" cy="35" r="9" fill="#fef3c7" stroke="#d97706" strokeWidth="2.5" />
            <circle cx="24" cy="35" r="5" fill="#fde047" stroke="#b45309" strokeWidth="1" />
            <circle cx="76" cy="35" r="9" fill="#fef3c7" stroke="#d97706" strokeWidth="2.5" />
            <circle cx="76" cy="35" r="5" fill="#fde047" stroke="#b45309" strokeWidth="1" />

            <path
              d="M 6,56 Q 50,62 94,56"
              fill="none"
              stroke="url(#gold-grad-icon)"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <rect x="22" y="52" width="6" height="8" rx="2" fill="#fbbf24" />
            <rect x="72" y="52" width="6" height="8" rx="2" fill="#fbbf24" />
          </g>
        </svg>
      </div>
    );
  }

  // 2. RECTANGULAR OFFICIAL LOGO FORMAT (avec arrière-plan transparent sans boîte noire opaque)
  if (variant === 'rectangular') {
    const isDark = theme === 'dark' && !transparent;

    return (
      <div
        className={`inline-flex items-center select-none shrink-0 text-left relative ${
          isDark
            ? 'bg-slate-950 border border-amber-500/80 px-2.5 py-1 rounded'
            : transparent
            ? 'bg-transparent border-0 px-0 py-0'
            : 'bg-transparent border border-amber-500/40 px-2 py-1 rounded'
        } ${className}`}
        style={{
          height: dimensions.rectHeight,
          width: 'max-content',
        }}
        aria-label="Logo Sté MORVELLO CARS - Where luxury meets the road"
      >
        {/* Left: Gold Luxury Shield Emblem with transparent background */}
        <div className="h-full flex items-center justify-center shrink-0 pr-3 z-10">
          {!imageError && (emblemTransp || newLogoTransp) ? (
            <img
              src={emblemTransp || newLogoTransp}
              alt="Morvello Emblem"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="h-full w-auto max-h-full object-contain filter drop-shadow-sm"
            />
          ) : (
            <div className="w-9 h-9 bg-slate-900 border border-amber-400 flex items-center justify-center">
              <span className="text-[11px] font-bold text-amber-400">MC</span>
            </div>
          )}
        </div>

        {/* Fine vertical gold line separator */}
        <div className="w-[1.5px] h-4/5 bg-gradient-to-b from-amber-500/20 via-amber-500/70 to-amber-500/20 shrink-0 z-10" />

        {/* Right: Typography with crisp lettering */}
        <div className="pl-3 flex flex-col justify-center z-10 space-y-0.5">
          <span
            className={`font-serif font-black tracking-wider uppercase leading-none whitespace-nowrap ${
              isDark ? 'text-amber-300' : 'text-slate-950'
            } ${dimensions.titleSize}`}
          >
            Sté MORVELLO CARS
          </span>
          <div
            className={`h-[1.5px] w-full ${
              isDark
                ? 'bg-gradient-to-r from-amber-400 via-amber-200 to-amber-400'
                : 'bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600'
            }`}
          />
          <span
            className={`font-sans font-black tracking-[0.14em] uppercase leading-none whitespace-nowrap ${
              isDark ? 'text-amber-200' : 'text-amber-800'
            } ${dimensions.taglineSize}`}
          >
            WHERE LUXURY MEETS THE ROAD
          </span>
          <span
            className={`font-sans font-bold tracking-wider uppercase leading-none whitespace-nowrap ${
              isDark ? 'text-slate-300' : 'text-slate-600'
            } ${dimensions.subSize}`}
          >
            Location de Voitures de Prestige
          </span>
        </div>
      </div>
    );
  }

  // 3. RAW RASTER IMAGE / OFFICIAL EMBEDDED LOGO (Logo officiel complet en PJ avec blason et bannière)
  if (!imageError && (variant === 'raw-image' || variant === 'full' || variant === 'vector')) {
    return (
      <div
        className={`inline-flex items-center justify-center select-none shrink-0 bg-transparent ${className}`}
        style={{
          height: customHeight || dimensions.height,
        }}
        aria-label="Logo Sté MORVELLO CARS - Where luxury meets the road"
      >
        <img
          src={newLogoTransp || newLogoFull || emblemTransp}
          alt="Sté MORVELLO CARS - Where luxury meets the road"
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
          className="h-full w-auto max-h-full object-contain filter drop-shadow-sm transition-transform"
          style={{
            maxHeight: customHeight || dimensions.height,
          }}
        />
      </div>
    );
  }

  // 3. VECTOR FALLBACK (HIGH RESOLUTION SVG BANNER)
  return (
    <div
      className={`inline-flex items-center select-none ${className}`}
      style={{ minWidth: dimensions.width }}
      aria-label="Logo Sté MORVELLO CARS - Where luxury meets the road"
    >
      <svg
        viewBox="0 0 320 120"
        className="w-full h-auto drop-shadow-md"
        style={{ maxHeight: dimensions.height * 1.5 }}
      >
        <defs>
          <linearGradient id="gold-luxury" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="25%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#fbbf24" />
            <stop offset="75%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>
          <linearGradient id="gold-text-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="40%" stopColor="#fde68a" />
            <stop offset="75%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>
          <linearGradient id="banner-bg" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
          <filter id="gold-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#d97706" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* TOP EMBLEM: GOLD SHIELD & VINTAGE CAR */}
        <g transform="translate(110, 2) scale(0.95)">
          <polygon
            points="50,2 88,18 88,52 50,78 12,52 12,18"
            fill="url(#banner-bg)"
            stroke="url(#gold-luxury)"
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
          <polygon
            points="50,8 82,22 82,48 50,71 18,48 18,22"
            fill="#090d16"
            stroke="url(#gold-luxury)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          <g transform="translate(14, 15) scale(0.72)">
            <path
              d="M 24,18 L 32,6 L 68,6 L 76,18 Z"
              fill="#1e293b"
              stroke="#fbbf24"
              strokeWidth="1.5"
            />
            <path
              d="M 12,20 Q 50,14 88,20 L 94,38 Q 50,42 6,38 Z"
              fill="#020617"
              stroke="#fbbf24"
              strokeWidth="2"
            />
            <rect
              x="36"
              y="18"
              width="28"
              height="28"
              rx="4"
              fill="#1e293b"
              stroke="#fbbf24"
              strokeWidth="2"
            />
            <line x1="42" y1="22" x2="42" y2="42" stroke="#fde68a" strokeWidth="1.5" />
            <line x1="47" y1="20" x2="47" y2="44" stroke="#fde68a" strokeWidth="1.5" />
            <line x1="50" y1="20" x2="50" y2="44" stroke="#fde68a" strokeWidth="1.5" />
            <line x1="53" y1="20" x2="53" y2="44" stroke="#fde68a" strokeWidth="1.5" />
            <line x1="58" y1="22" x2="58" y2="42" stroke="#fde68a" strokeWidth="1.5" />

            <circle cx="22" cy="30" r="8.5" fill="#fef3c7" stroke="#d97706" strokeWidth="2.2" />
            <circle cx="22" cy="30" r="4.5" fill="#fde047" stroke="#b45309" strokeWidth="1" />
            <circle cx="78" cy="30" r="8.5" fill="#fef3c7" stroke="#d97706" strokeWidth="2.2" />
            <circle cx="78" cy="30" r="4.5" fill="#fde047" stroke="#b45309" strokeWidth="1" />

            <path
              d="M 4,48 Q 50,54 96,48"
              fill="none"
              stroke="url(#gold-luxury)"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            <rect x="20" y="44" width="5" height="7" rx="1.5" fill="#fbbf24" />
            <rect x="75" y="44" width="5" height="7" rx="1.5" fill="#fbbf24" />
          </g>
        </g>

        {/* LOWER BANNER: Sté MORVELLO CARS */}
        <g transform="translate(0, 56)">
          <path
            d="M 12,18 L 30,8 L 290,8 L 308,18 L 296,46 L 160,56 L 24,46 Z"
            fill="url(#banner-bg)"
            stroke="url(#gold-luxury)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <text
            x="160"
            y="35"
            textAnchor="middle"
            fontFamily="Cinzel, Times New Roman, serif"
            fontSize="21"
            fontWeight="900"
            letterSpacing="1.8"
            fill="url(#gold-text-grad)"
            filter="url(#gold-glow)"
          >
            Sté MORVELLO CARS
          </text>
        </g>

        {/* TAGLINE: WHERE LUXURY MEETS THE ROAD */}
        {showTagline && (
          <g transform="translate(0, 102)">
            <line x1="28" y1="4" x2="65" y2="4" stroke="url(#gold-luxury)" strokeWidth="1" />
            <circle cx="68" cy="4" r="1.5" fill="#fbbf24" />
            <text
              x="160"
              y="7"
              textAnchor="middle"
              fontFamily="Montserrat, system-ui, sans-serif"
              fontSize="8.5"
              fontWeight="700"
              letterSpacing="2.8"
              fill="#fbbf24"
            >
              WHERE LUXURY MEETS THE ROAD
            </text>
            <circle cx="252" cy="4" r="1.5" fill="#fbbf24" />
            <line x1="255" y1="4" x2="292" y2="4" stroke="url(#gold-luxury)" strokeWidth="1" />
          </g>
        )}
      </svg>
    </div>
  );
};
