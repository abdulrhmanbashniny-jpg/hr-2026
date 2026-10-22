import { Star } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Five stars, filled to the nearest half. Gold for the filled part, the outline tone for the rest. */
export function Stars({ value, size = 16, className, label }: { value: number; size?: number; className?: string; label?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} role="img" aria-label={label}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        const pct = fill >= 0.75 ? 100 : fill >= 0.25 ? 50 : 0;
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }} aria-hidden>
            <Star className="absolute inset-0 text-outline-variant" style={{ width: size, height: size }} />
            {pct > 0 && (
              <span className="absolute inset-y-0 start-0 overflow-hidden" style={{ width: `${pct}%` }}>
                <Star className="fill-secondary-container text-secondary-container" style={{ width: size, height: size }} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
