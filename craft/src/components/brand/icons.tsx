import type { SVGProps } from 'react';

export function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2Zm5.8 14.03c-.24.68-1.42 1.32-1.96 1.36-.5.05-.97.23-3.27-.68-2.77-1.09-4.52-3.92-4.66-4.1-.13-.18-1.11-1.48-1.11-2.82 0-1.34.7-2 .95-2.27.25-.27.54-.34.72-.34h.52c.17 0 .39-.06.61.47.24.56.79 1.92.86 2.06.07.14.11.3.02.48-.09.18-.14.3-.27.46-.14.16-.29.36-.41.48-.14.14-.28.29-.12.56.16.27.7 1.16 1.51 1.88 1.04.93 1.91 1.21 2.18 1.35.27.14.43.11.59-.07.16-.18.68-.79.86-1.06.18-.27.36-.23.61-.14.25.09 1.58.75 1.85.88.27.14.45.2.52.32.07.11.07.66-.17 1.33Z" />
    </svg>
  );
}

/** The Hirfa mark: a brush stroke inside a rounded badge. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden>
      {/* Solid fills only: a gradient id shared by several copies breaks when the first copy is hidden. */}
      <rect width="48" height="48" rx="14" fill="#102A43" />
      <path d="M12 31c5-1 7-6 11-10s9-6 13-5c-1 4-4 8-8 11s-9 5-16 4Z" fill="#F59E0B" />
      <path d="M20 26c3-3 7-6 13-8-2 3-5 6-8 7.5-2 .9-3.6.8-5 .5Z" fill="#FBBF24" opacity=".85" />
      <path d="M12 31c2 3 5 5 9 5" stroke="#FBBF24" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity=".7" />
      <circle cx="35" cy="14" r="2.6" fill="#fff" opacity=".9" />
    </svg>
  );
}

export function Logo({ name, className }: { name: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <LogoMark size={34} />
      <span className="text-xl font-bold tracking-tight text-ink">{name}</span>
    </span>
  );
}
