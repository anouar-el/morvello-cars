import React, { useState } from 'react';
import newStampImg from '../assets/images/morvello_nouveau_cachet_transp.png';

export interface CompanyStampProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  rotation?: number;
  format?: 'rectangular' | 'circular';
  renderMode?: 'auto' | 'image' | 'vector';
}

export const CompanyStamp: React.FC<CompanyStampProps> = ({
  className = '',
  size = 'md',
  rotation = -1.5,
  format = 'rectangular',
  renderMode = 'auto',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  // Rectangular Dimensions Map
  const rectDimensions = {
    xs: { width: 140, height: 64 },
    sm: { width: 184, height: 84 },
    md: { width: 242, height: 110 },
    lg: { width: 300, height: 136 },
    xl: { width: 370, height: 168 },
  }[size];

  // Circular Dimensions Map (Legacy fallback)
  const circleDimensions = {
    xs: 72,
    sm: 88,
    md: 128,
    lg: 168,
    xl: 210,
  }[size];

  // If circular format is requested explicitly
  if (format === 'circular') {
    const numTeeth = 72;
    const teeth = Array.from({ length: numTeeth }, (_, i) => (i * 360) / numTeeth);

    return (
      <div
        className={`relative select-none pointer-events-none inline-flex items-center justify-center shrink-0 ${className}`}
        style={{
          width: circleDimensions,
          height: circleDimensions,
          transform: `rotate(${rotation}deg)`,
        }}
        aria-label="Cachet circulaire Sté MORVELLO CARS"
      >
        <svg
          viewBox="0 0 300 300"
          className="w-full h-full drop-shadow-xs overflow-visible"
          style={{ filter: 'contrast(1.18) opacity(0.95)' }}
        >
          <defs>
            <filter id="circular-stamp-texture" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.4" xChannelSelector="R" yChannelSelector="G" />
            </filter>
            <path id="text-path-arc-circle" d="M 42 150 A 108 108 0 0 1 258 150" fill="none" />
          </defs>

          <g filter="url(#circular-stamp-texture)" stroke="#173b87" fill="#173b87">
            <circle cx="150" cy="150" r="142" fill="none" strokeWidth="5" />
            <g>
              {teeth.map((angle) => (
                <line
                  key={angle}
                  x1="150"
                  y1="10"
                  x2="150"
                  y2="18"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  transform={`rotate(${angle} 150 150)`}
                />
              ))}
            </g>
            <circle cx="150" cy="150" r="130" fill="none" strokeWidth="2" />
            <text
              fontSize="26"
              fontWeight="900"
              fontFamily="Arial Black, Impact, system-ui, sans-serif"
              letterSpacing="2.8"
              stroke="none"
              fill="#173b87"
            >
              <textPath href="#text-path-arc-circle" startOffset="50%" textAnchor="middle">
                Sté MORVELLO CARS
              </textPath>
            </text>

            <g transform="translate(85, 75) scale(0.65)">
              <polygon
                points="100,5 185,32 185,115 100,185 15,115 15,32"
                fill="none"
                strokeWidth="5.5"
                strokeLinejoin="round"
              />
              <polygon
                points="100,17 172,40 172,108 100,168 28,108 28,40"
                fill="none"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <g transform="translate(10, 30)">
                <path d="M 45,28 L 58,10 L 122,10 L 135,28 Z" fill="none" strokeWidth="3.5" />
                <path d="M 28,32 Q 90,24 152,32 L 164,68 Q 90,75 16,68 Z" fill="none" strokeWidth="4" />
                <rect x="68" y="30" width="44" height="48" rx="6" fill="none" strokeWidth="4" />
                <line x1="78" y1="36" x2="78" y2="72" strokeWidth="2.5" />
                <line x1="84" y1="34" x2="84" y2="74" strokeWidth="2.5" />
                <line x1="90" y1="34" x2="90" y2="74" strokeWidth="2.5" />
                <line x1="96" y1="34" x2="96" y2="74" strokeWidth="2.5" />
                <line x1="102" y1="36" x2="102" y2="72" strokeWidth="2.5" />
                <circle cx="44" cy="52" r="14" fill="none" strokeWidth="4" />
                <circle cx="44" cy="52" r="6" fill="none" strokeWidth="2" />
                <circle cx="136" cy="52" r="14" fill="none" strokeWidth="4" />
                <circle cx="136" cy="52" r="6" fill="none" strokeWidth="2" />
                <path d="M 12,82 Q 90,92 168,82" fill="none" strokeWidth="7" strokeLinecap="round" />
                <rect x="42" y="74" width="8" height="14" rx="3" fill="#173b87" stroke="none" />
                <rect x="130" y="74" width="8" height="14" rx="3" fill="#173b87" stroke="none" />
                <rect x="18" y="58" width="16" height="32" rx="4" fill="none" strokeWidth="3.5" />
                <rect x="146" y="58" width="16" height="32" rx="4" fill="none" strokeWidth="3.5" />
              </g>
            </g>

            <text
              x="150"
              y="218"
              textAnchor="middle"
              fontSize="14.5"
              fontWeight="900"
              fontFamily="system-ui, -apple-system, sans-serif"
              letterSpacing="0.8"
              stroke="none"
              fill="#173b87"
            >
              IF : 66223306 • RC : 664751
            </text>
            <text
              x="150"
              y="242"
              textAnchor="middle"
              fontSize="15.5"
              fontWeight="900"
              fontFamily="system-ui, -apple-system, sans-serif"
              letterSpacing="1"
              stroke="none"
              fill="#173b87"
            >
              ICE : 00366965500062
            </text>
          </g>
        </svg>
      </div>
    );
  }

  // RECTANGULAR NEW STAMP (DEFAULT - Exactly matching user's uploaded stamp)
  // Mode 1: Image Mode if available and requested/auto
  if ((renderMode === 'image' || renderMode === 'auto') && !imgFailed && newStampImg) {
    return (
      <div
        className={`relative select-none pointer-events-none inline-flex items-center justify-center shrink-0 ${className}`}
        style={{
          width: rectDimensions.width,
          height: rectDimensions.height,
          transform: `rotate(${rotation}deg)`,
        }}
        aria-label="Nouveau Cachet Officiel Rectangulaire Sté MORVELLO CARS"
      >
        <img
          src={newStampImg}
          alt="Cachet officiel Sté MORVELLO CARS"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain filter drop-shadow-xs"
          style={{
            mixBlendMode: 'multiply',
            opacity: 0.94,
          }}
        />
      </div>
    );
  }

  // Mode 2: Ultra-Crisp Vector SVG Representation with Authentic Rubber Ink Texture
  return (
    <div
      className={`relative select-none pointer-events-none inline-flex items-center justify-center shrink-0 ${className}`}
      style={{
        width: rectDimensions.width,
        height: rectDimensions.height,
        transform: `rotate(${rotation}deg)`,
      }}
      aria-label="Nouveau Cachet Officiel Rectangulaire Sté MORVELLO CARS"
    >
      <svg
        viewBox="0 0 520 240"
        className="w-full h-full drop-shadow-xs overflow-visible"
        style={{ filter: 'contrast(1.15) opacity(0.95)' }}
      >
        <defs>
          {/* Subtle ink roughness filter mimicking rubber stamp ink bleed */}
          <filter id="rect-stamp-texture" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>

        <g filter="url(#rect-stamp-texture)" stroke="#163982" fill="#163982">
          {/* 1. OUTER HEAVY ROUNDED BORDER */}
          <rect
            x="8"
            y="8"
            width="504"
            height="224"
            rx="20"
            ry="20"
            fill="none"
            strokeWidth="4"
            strokeLinejoin="round"
          />

          {/* 2. INNER THIN ROUNDED BORDER */}
          <rect
            x="16"
            y="16"
            width="488"
            height="208"
            rx="14"
            ry="14"
            fill="none"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />

          {/* 3. LEFT SECTION: SHIELD & VINTAGE CLASSIC CAR */}
          <g transform="translate(18, 14)">
            {/* Outer Shield Outline */}
            <polygon
              points="75,22 136,44 136,126 75,182 14,126 14,44"
              fill="none"
              strokeWidth="4.2"
              strokeLinejoin="round"
            />
            {/* Inner Shield Outline */}
            <polygon
              points="75,32 126,50 126,120 75,170 24,120 24,50"
              fill="none"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />

            {/* Vintage Car Details Inside Shield */}
            <g transform="translate(12, 38) scale(0.85)">
              {/* Windshield split */}
              <path
                d="M 36,24 L 46,10 L 102,10 L 112,24 Z"
                fill="none"
                strokeWidth="2.8"
                strokeLinejoin="round"
              />
              <line x1="74" y1="10" x2="74" y2="24" strokeWidth="2.2" />

              {/* Hood & Cowl */}
              <path
                d="M 22,26 Q 74,18 126,26 L 134,60 Q 74,68 14,60 Z"
                fill="none"
                strokeWidth="3.4"
                strokeLinejoin="round"
              />

              {/* Center Radiator Grille */}
              <rect
                x="56"
                y="26"
                width="36"
                height="44"
                rx="6"
                fill="none"
                strokeWidth="3.4"
              />
              {/* Vertical Grille Bars */}
              <line x1="64" y1="31" x2="64" y2="65" strokeWidth="2" />
              <line x1="69" y1="29" x2="69" y2="67" strokeWidth="2" />
              <line x1="74" y1="29" x2="74" y2="67" strokeWidth="2" />
              <line x1="79" y1="29" x2="79" y2="67" strokeWidth="2" />
              <line x1="84" y1="31" x2="84" y2="65" strokeWidth="2" />

              {/* Headlights Left */}
              <circle cx="34" cy="46" r="12" fill="none" strokeWidth="3.5" />
              <circle cx="34" cy="46" r="5" fill="none" strokeWidth="1.8" />

              {/* Headlights Right */}
              <circle cx="114" cy="46" r="12" fill="none" strokeWidth="3.5" />
              <circle cx="114" cy="46" r="5" fill="none" strokeWidth="1.8" />

              {/* Front Heavy Bumper */}
              <path
                d="M 8,74 Q 74,83 140,74"
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
              />
              {/* Bumper Over-riders */}
              <rect x="34" y="66" width="7" height="13" rx="2" fill="#163982" stroke="none" />
              <rect x="107" y="66" width="7" height="13" rx="2" fill="#163982" stroke="none" />

              {/* Wheel Fenders / Tires */}
              <rect x="14" y="52" width="13" height="26" rx="4" fill="none" strokeWidth="3" />
              <rect x="121" y="52" width="13" height="26" rx="4" fill="none" strokeWidth="3" />
            </g>
          </g>

          {/* 4. RIGHT SECTION: TEXT CONTENT & LEGAL IDENTIFIERS */}
          {/* Top Line: Sté MORVELLO CARS */}
          <text
            x="172"
            y="92"
            textAnchor="start"
            fontSize="37"
            fontWeight="900"
            fontFamily="'Impact', 'Arial Black', sans-serif"
            letterSpacing="2.2"
            stroke="none"
            fill="#163982"
          >
            <tspan fontSize="28" dy="-4">S</tspan>
            <tspan fontSize="24" dy="-4">t</tspan>
            <tspan fontSize="24">é</tspan>
            <tspan fontSize="37" dy="8"> MORVELLO CARS</tspan>
          </text>

          {/* Horizontal Divider Rule */}
          <line
            x1="172"
            y1="116"
            x2="490"
            y2="116"
            strokeWidth="3.2"
            strokeLinecap="round"
          />

          {/* Line 2: IF : 66223306 • RC : 664751 */}
          <text
            x="172"
            y="155"
            textAnchor="start"
            fontSize="21.5"
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
            letterSpacing="1.2"
            stroke="none"
            fill="#163982"
          >
            IF : 66223306 &nbsp;•&nbsp; RC : 664751
          </text>

          {/* Line 3: ICE : 00366965500062 */}
          <text
            x="172"
            y="194"
            textAnchor="start"
            fontSize="22"
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
            letterSpacing="1.4"
            stroke="none"
            fill="#163982"
          >
            ICE : 00366965500062
          </text>

          {/* Organic ink stamp distress particles */}
          <circle cx="28" cy="28" r="1.2" stroke="none" fill="#163982" opacity="0.6" />
          <circle cx="494" cy="34" r="1.5" stroke="none" fill="#163982" opacity="0.5" />
          <circle cx="502" cy="204" r="1.2" stroke="none" fill="#163982" opacity="0.6" />
          <circle cx="168" cy="116" r="1.8" stroke="none" fill="#163982" opacity="0.7" />
          <circle cx="340" cy="118" r="1.2" stroke="none" fill="#163982" opacity="0.5" />
        </g>
      </svg>
    </div>
  );
};

