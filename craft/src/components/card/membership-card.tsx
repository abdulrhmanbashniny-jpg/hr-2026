'use client';

import { BadgeCheck, MapPin, RefreshCw } from 'lucide-react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LogoMark } from '@/components/brand/icons';
import { cn } from '@/lib/cn';
import { fmtCode } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';
import type { Tier } from '@/lib/incentives/engine';

export interface CardData {
  name: string;
  code: string;
  tier: Tier;
  city: string;
  memberSince: string;
  verified?: boolean;
}

const FINISH: Record<Tier, { base: string; foil: string; chip: string; ring: string }> = {
  A: {
    base: 'radial-gradient(130% 140% at 100% 0%, #243b53 0%, #102a43 48%, #0a1b2c 100%)',
    foil: 'linear-gradient(115deg, transparent 32%, rgba(251,191,36,.16) 42%, rgba(253,230,138,.38) 48%, rgba(245,158,11,.14) 54%, transparent 64%)',
    chip: 'linear-gradient(135deg,#fde68a,#f59e0b 55%,#b45309)',
    ring: '#FBBF24',
  },
  B: {
    base: 'radial-gradient(130% 140% at 100% 0%, #334e68 0%, #1b3550 50%, #102a43 100%)',
    foil: 'linear-gradient(115deg, transparent 32%, rgba(226,232,240,.14) 42%, rgba(255,255,255,.32) 48%, rgba(203,213,225,.12) 54%, transparent 64%)',
    chip: 'linear-gradient(135deg,#f1f5f9,#94a3b8 55%,#475569)',
    ring: '#CBD5E1',
  },
  C: {
    base: 'radial-gradient(130% 140% at 100% 0%, #2b4762 0%, #183654 50%, #102a43 100%)',
    foil: 'linear-gradient(115deg, transparent 34%, rgba(255,255,255,.08) 45%, rgba(255,255,255,.16) 50%, transparent 62%)',
    chip: 'linear-gradient(135deg,#fcd9a5,#d68a2f 55%,#8a4b0f)',
    ring: '#F59E0B',
  },
};

/**
 * The membership card: a 3D parallax tilt that follows the pointer (or the phone's gyroscope),
 * a specular highlight and foil band that move with it, and a flip to the QR side.
 */
export function MembershipCard({ data, qrTarget = 'profile', flippable = true, className, initialFlipped = false }: { data: CardData; qrTarget?: 'profile' | 'join'; flippable?: boolean; className?: string; initialFlipped?: boolean }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(initialFlipped);
  const [gyro, setGyro] = useState<'off' | 'needs-permission' | 'on'>('off');
  const [host, setHost] = useState('');
  useEffect(() => setHost(location.host), []);

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 300, damping: 25 });
  const sy = useSpring(py, { stiffness: 300, damping: 25 });
  const rotateY = useTransform(sx, [0, 1], reduced ? [0, 0] : [-14, 14]);
  const rotateX = useTransform(sy, [0, 1], reduced ? [0, 0] : [10, -10]);
  const glareX = useTransform(sx, [0, 1], ['0%', '100%']);
  const glareY = useTransform(sy, [0, 1], ['0%', '100%']);
  const foilX = useTransform(sx, [0, 1], ['-40%', '40%']);
  // The foil only catches the light when the card is tilted, like a real hologram.
  const foilOpacity = useTransform([sx, sy], ([x, y]: number[]) => Math.min(1, Math.hypot(x - 0.5, y - 0.5) * 3));
  const glare = useTransform([glareX, glareY], ([x, y]) => `radial-gradient(circle at ${x} ${y}, rgba(255,255,255,.18), transparent 45%)`);

  const onPointer = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      px.set((e.clientX - r.left) / r.width);
      py.set((e.clientY - r.top) / r.height);
    },
    [px, py],
  );
  const reset = () => {
    px.set(0.5);
    py.set(0.5);
  };

  useEffect(() => {
    if (reduced || typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;
    const needsPermission = typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === 'function';
    if (needsPermission) {
      setGyro('needs-permission');
      return;
    }
    if (!matchMedia('(pointer: coarse)').matches) return;
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      px.set(Math.max(0, Math.min(1, 0.5 + e.gamma / 50)));
      py.set(Math.max(0, Math.min(1, 0.5 + (e.beta - 45) / 60)));
    };
    window.addEventListener('deviceorientation', onOrient);
    setGyro('on');
    return () => window.removeEventListener('deviceorientation', onOrient);
  }, [reduced, px, py]);

  async function enableGyro() {
    const req = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
    if (!req) return;
    if ((await req()) !== 'granted') return;
    window.addEventListener('deviceorientation', (e) => {
      if (e.beta === null || e.gamma === null) return;
      px.set(Math.max(0, Math.min(1, 0.5 + e.gamma / 50)));
      py.set(Math.max(0, Math.min(1, 0.5 + (e.beta - 45) / 60)));
    });
    setGyro('on');
  }

  const finish = FINISH[data.tier];
  const joined = new Date(data.memberSince);
  const since = `${String(joined.getMonth() + 1).padStart(2, '0')}/${String(joined.getFullYear()).slice(2)}`;
  const qrSrc = `/api/v1/craftsmen/${data.code}/qr?target=${qrTarget}&src=qr`;

  return (
    <div className={cn('w-full', className)}>
      <div ref={ref} className="relative mx-auto aspect-[1.586] w-full max-w-[420px] [perspective:1200px]" onPointerMove={onPointer} onPointerLeave={reset}>
        <motion.div className="relative size-full [transform-style:preserve-3d]" style={{ rotateX, rotateY }}>
          <motion.div className="absolute inset-0 [transform-style:preserve-3d]" animate={{ rotateY: flipped ? 180 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
            {/* Front */}
            <div className="grain absolute inset-0 overflow-hidden rounded-[22px] text-white shadow-lg [backface-visibility:hidden]" style={{ background: finish.base }}>
              <div className="pattern-grid absolute inset-0 opacity-60" />
              <motion.div className="pointer-events-none absolute inset-y-0 -inset-x-1/2 mix-blend-screen" style={{ background: finish.foil, x: foilX, opacity: foilOpacity }} />
              <motion.div className="pointer-events-none absolute inset-0" style={{ background: glare }} />
              <div className="relative flex h-full flex-col justify-between p-[6%]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <LogoMark size={34} />
                    <div className="leading-tight">
                      <div className="text-[15px] font-bold">{t.meta.product}</div>
                      <div className="text-[11px] text-white/65">{t.card.title}</div>
                    </div>
                  </div>
                  <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold" style={{ borderColor: `${finish.ring}66`, color: finish.ring, background: `${finish.ring}14` }}>
                    {t.tiers.short[data.tier]}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-3 h-7 w-10 rounded-md shadow-inner" style={{ background: finish.chip }} aria-hidden />
                    <div className="flex items-center gap-1.5 truncate text-lg font-bold sm:text-xl">
                      <span className="truncate">{data.name}</span>
                      {data.verified && <BadgeCheck className="size-5 shrink-0 text-accent-2" />}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-white/70">
                      <MapPin className="size-3.5" />
                      {data.city}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="text-[10px] tracking-wide text-white/55 uppercase">{t.profile.memberNo}</div>
                    <div className="num text-2xl font-semibold tracking-[0.12em] sm:text-[28px]" style={{ color: finish.ring }}>
                      {fmtCode(data.code)}
                    </div>
                    <div className="num text-[11px] text-white/55">{since}</div>
                  </div>
                </div>
              </div>
            </div>
            {/* Back */}
            <div className="absolute inset-0 overflow-hidden rounded-[22px] bg-white text-navy-900 shadow-lg [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <div className="flex h-full items-center gap-[6%] p-[6%]">
                <div className="aspect-square h-full rounded-2xl border border-navy-100 bg-white p-2.5">
                  <img src={qrSrc} alt={qrTarget === 'join' ? t.card.qrJoinHint : t.card.qrProfileHint} className="size-full" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="text-xs text-navy-500">{qrTarget === 'join' ? t.card.qrJoinHint : t.card.qrProfileHint}</div>
                  <div className="num text-2xl font-semibold tracking-[0.12em]">{fmtCode(data.code)}</div>
                  <div className="truncate text-sm font-semibold">{data.name}</div>
                  <div className="text-[11px] text-navy-500">
                    {t.card.validFor} <span className="num">{host}/c/{data.code}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
      {flippable && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={() => setFlipped((f) => !f)} className="press inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink-2 hover:text-ink">
            <RefreshCw className="size-4" />
            {t.card.flip}
          </button>
          {gyro === 'needs-permission' && (
            <button type="button" onClick={enableGyro} className="press rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink-2 hover:text-ink">
              {t.card.enableMotion}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
