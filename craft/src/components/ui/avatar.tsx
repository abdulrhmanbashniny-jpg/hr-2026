import { cn } from '@/lib/cn';

const PALETTE = ['#102a43', '#334e68', '#7c4a03', '#0f5132', '#5b2a86', '#8a1c3d', '#1f4e79'];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? '?').slice(0, 2)).toUpperCase();
}

export function Avatar({ name, src, size = 48, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const color = PALETTE[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % PALETTE.length];
  if (src) return <img src={src} alt="" width={size} height={size} className={cn('shrink-0 rounded-2xl object-cover', className)} style={{ width: size, height: size }} />;
  return (
    <div aria-hidden className={cn('grid shrink-0 place-items-center rounded-2xl font-semibold text-white', className)} style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}>
      {initials(name)}
    </div>
  );
}
