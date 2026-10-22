import type { SVGProps } from 'react';

export function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2Zm5.8 14.03c-.24.68-1.42 1.32-1.96 1.36-.5.05-.97.23-3.27-.68-2.77-1.09-4.52-3.92-4.66-4.1-.13-.18-1.11-1.48-1.11-2.82 0-1.34.7-2 .95-2.27.25-.27.54-.34.72-.34h.52c.17 0 .39-.06.61.47.24.56.79 1.92.86 2.06.07.14.11.3.02.48-.09.18-.14.3-.27.46-.14.16-.29.36-.41.48-.14.14-.28.29-.12.56.16.27.7 1.16 1.51 1.88 1.04.93 1.91 1.21 2.18 1.35.27.14.43.11.59-.07.16-.18.68-.79.86-1.06.18-.27.36-.23.61-.14.25.09 1.58.75 1.85.88.27.14.45.2.52.32.07.11.07.66-.17 1.33Z" />
    </svg>
  );
}

/** The platform mark: a paint roller inside a rounded navy badge (from the brand sheet). */
export function LogoMark({ size = 32, className, tone = 'navy' }: { size?: number; className?: string; tone?: 'navy' | 'glass' }) {
  return (
    <svg width={size} height={size} viewBox="6 8 44 44" className={className} aria-hidden>
      <rect x="6" y="8" width="44" height="44" rx="12" fill={tone === 'glass' ? 'rgb(255 255 255 / 0.1)' : '#102A43'} />
      <path d="M18 20a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2v-6Z" fill="#FBBF24" />
      <path d="M28 28v8a2 2 0 0 1-2 2h-2" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="24" cy="40" r="2" fill="#F59E0B" />
      <path d="M34 23H22" stroke="#102A43" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Mark + name + strapline, as in the brand sheet. */
export function Logo({ name, tagline, className, size = 40, inverted = false }: { name: string; tagline?: string; className?: string; size?: number; inverted?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ''}`}>
      <LogoMark size={size} className="shrink-0" />
      <span className="flex flex-col leading-tight">
        <span className={`text-headline-sm font-bold tracking-tight ${inverted ? 'text-white' : 'text-primary-container'}`}>{name}</span>
        {tagline ? <span className={`text-body-sm ${inverted ? 'text-on-primary-container' : 'text-muted'}`}>{tagline}</span> : null}
      </span>
    </span>
  );
}
