import { useId } from 'react';

export function BrandMark({ size = 38 }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="brand-mark" aria-hidden="true">
      <defs>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="55%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id={`s-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(99,102,241,0.35)" />
          <stop offset="100%" stopColor="rgba(34,211,238,0.05)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="#080d1c" stroke={`url(#g-${id})`} strokeOpacity="0.35" />
      <path d="M18 46 32 14l14 32-7.2 4.4L32 36.6 25.2 50.4z" fill={`url(#g-${id})`} />
      <circle cx="32" cy="14" r="3.2" fill="#e0e7ff" />
      <rect x="12" y="12" width="40" height="40" rx="14" fill={`url(#s-${id})`} />
    </svg>
  );
}

export function Brand({ compact = false }) {
  return (
    <span className={compact ? 'brand compact' : 'brand'}>
      <BrandMark size={compact ? 32 : 38} />
      {!compact ? (
        <span className="brand-text">
          <span className="brand-name">AURORA</span>
          <span className="brand-sub">WELCOME SYSTEM</span>
        </span>
      ) : null}
    </span>
  );
}
