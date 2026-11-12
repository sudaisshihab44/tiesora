import React from 'react';

// ─── Tiesora Design Tokens ───────────────────────────────────────────────────
export const brand = {
  name: 'Tiesora',
  tagline: 'Every family. Every connection. Every story.',
  colors: {
    forest: '#285C43',     // primary brand green
    deep: '#193D2D',       // deep background green
    sage: '#E7F0E8',       // soft sage tint
    ivory: '#FAF9F6',      // warm ivory background
    white: '#FFFFFF',
    charcoal: '#202820',   // near-black text
  },
} as const;

// ─── Symbol mark (interconnected nodes) ──────────────────────────────────────
export const TiesoraSymbol: React.FC<{ className?: string; size?: number }> = ({
  className = '',
  size = 32,
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 32 32"
    width={size}
    height={size}
    className={className}
    aria-hidden="true"
  >
    {/* Background */}
    <rect width="32" height="32" rx="8" fill={brand.colors.forest} />

    {/* Central node */}
    <circle cx="16" cy="16" r="3.2" fill={brand.colors.ivory} />

    {/* 4 branch lines */}
    <line x1="16" y1="16" x2="9"  y2="9"  stroke={brand.colors.sage} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="16" y1="16" x2="23" y2="9"  stroke={brand.colors.sage} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="16" y1="16" x2="9"  y2="23" stroke={brand.colors.sage} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="16" y1="16" x2="23" y2="23" stroke={brand.colors.sage} strokeWidth="1.5" strokeLinecap="round" />

    {/* 4 outer nodes */}
    <circle cx="9"  cy="9"  r="2.4" fill="#52876A" stroke={brand.colors.sage} strokeWidth="1" />
    <circle cx="23" cy="9"  r="2.4" fill="#52876A" stroke={brand.colors.sage} strokeWidth="1" />
    <circle cx="9"  cy="23" r="2.4" fill="#52876A" stroke={brand.colors.sage} strokeWidth="1" />
    <circle cx="23" cy="23" r="2.4" fill="#52876A" stroke={brand.colors.sage} strokeWidth="1" />

    {/* 4 leaf sub-nodes (smaller) */}
    <circle cx="5.5"  cy="5.5"  r="1.5" fill={brand.colors.sage} opacity="0.7" />
    <circle cx="26.5" cy="5.5"  r="1.5" fill={brand.colors.sage} opacity="0.7" />
    <circle cx="5.5"  cy="26.5" r="1.5" fill={brand.colors.sage} opacity="0.7" />
    <circle cx="26.5" cy="26.5" r="1.5" fill={brand.colors.sage} opacity="0.7" />
  </svg>
);

// ─── Full wordmark with symbol ────────────────────────────────────────────────
interface TiesoraLogoProps {
  /** 'default' = symbol + wordmark; 'symbol' = icon only; 'wordmark' = text only */
  variant?: 'default' | 'symbol' | 'wordmark';
  /** Size preset controls symbol size and text scaling */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Override symbol size in px (takes precedence over size preset) */
  symbolSize?: number;
  className?: string;
  /** Show tagline beneath wordmark (only in 'default' and 'wordmark' variants) */
  showTagline?: boolean;
}

const sizeMap = {
  xs: { symbol: 20, text: 'text-sm',  tagline: 'text-[9px]'  },
  sm: { symbol: 26, text: 'text-base', tagline: 'text-[10px]' },
  md: { symbol: 32, text: 'text-xl',  tagline: 'text-[11px]' },
  lg: { symbol: 40, text: 'text-2xl', tagline: 'text-xs'     },
};

export const TiesoraLogo: React.FC<TiesoraLogoProps> = ({
  variant = 'default',
  size = 'md',
  symbolSize,
  className = '',
  showTagline = false,
}) => {
  const s = sizeMap[size];
  const iconSize = symbolSize ?? s.symbol;

  if (variant === 'symbol') {
    return <TiesoraSymbol size={iconSize} className={className} />;
  }

  if (variant === 'wordmark') {
    return (
      <div className={`flex flex-col ${className}`}>
        <span
          className={`font-extrabold tracking-tight leading-none`}
          style={{ fontSize: iconSize, color: brand.colors.charcoal }}
        >
          {brand.name}
        </span>
        {showTagline && (
          <span className={`${s.tagline} mt-0.5`} style={{ color: '#6b7280' }}>
            {brand.tagline}
          </span>
        )}
      </div>
    );
  }

  // default: symbol + wordmark
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <TiesoraSymbol size={iconSize} />
      <div className="flex flex-col leading-none">
        <span
          className="font-extrabold tracking-tight leading-none"
          style={{ color: brand.colors.charcoal }}
        >
          {brand.name}
        </span>
        {showTagline && (
          <span className={`${s.tagline} mt-0.5`} style={{ color: '#6b7280' }}>
            {brand.tagline}
          </span>
        )}
      </div>
    </div>
  );
};
