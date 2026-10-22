'use client';

import { BadgeCheck, CircleCheck, MapPin, RefreshCw } from 'lucide-react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LogoMark } from '@/components/brand/icons';
import { initials } from '@/components/ui/avatar';
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
  photoUrl?: string | null;
  /** Trade line under the name, e.g. "معلم دهانات وتشطيبات ديكورية". Falls back to the tier role. */
  classification?: string | null;
}

/** Rim and badge tint per tier; the card body is the same deep navy for everyone. */
const RIM: Record<Tier, string> = { A: '#FBBF24', B: '#CBD5E1', C: '#F59E0B' };

/**
 * The membership card, laid out like an ID card: brand and tier on top, the craftsman's photo, name
 * and classification in the middle, the member number and a QR that opens the public profile at the
 * bottom. It tilts in 3D with the pointer (or the phone's gyroscope) and flips to a large QR.
 * Sizes are in container units so the card keeps its proportions at any width.
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
  const rotateY = useTransform(sx, [0, 1], reduced ? [0, 0] : [-12, 12]);
  const rotateX = useTransform(sy, [0, 1], reduced ? [0, 0] : [9, -9]);
  const glareX = useTransform(sx, [0, 1], ['0%', '100%']);
  const glareY = useTransform(sy, [0, 1], ['0%', '100%']);
  const glare = useTransform([glareX, glareY], ([x, y]) => `radial-gradient(circle at ${x} ${y}, rgba(255,255,255,.14), transparent 45%)`);
  // A thin gold sheen that only catches the light when the card is tilted.
  const sheenX = useTransform(sx, [0, 1], ['-40%', '40%']);
  const sheenOpacity = useTransform([sx, sy], ([x, y]: number[]) => Math.min(1, Math.hypot(x - 0.5, y - 0.5) * 2.4));

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

  const rim = RIM[data.tier];
  const joined = new Date(data.memberSince);
  const since = `${String(joined.getMonth() + 1).padStart(2, '0')}/${joined.getFullYear()}`;
  const qrSrc = `/api/v1/craftsmen/${data.code}/qr?target=${qrTarget}&src=qr`;
  const qrHint = qrTarget === 'join' ? t.card.qrJoinHint : t.card.qrProfileHint;

  return (
    <div className={cn('w-full', className)}>
      <div ref={ref} className="relative mx-auto aspect-[1.586] w-full max-w-[480px] [perspective:1200px]" onPointerMove={onPointer} onPointerLeave={reset}>
        <motion.div className="relative size-full [transform-style:preserve-3d]" style={{ rotateX, rotateY }}>
          <motion.div className="absolute inset-0 [transform-style:preserve-3d]" animate={{ rotateY: flipped ? 180 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
            {/* Front */}
            <div className="vip-surface absolute inset-0 overflow-hidden rounded-2xl text-white [backface-visibility:hidden] [container-type:inline-size]" style={{ borderColor: `${rim}33` }}>
              <div className="pointer-events-none absolute -top-[30%] -right-[20%] size-[70%] rounded-full bg-secondary/15 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-[30%] -left-[15%] size-[55%] rounded-full bg-primary-container/60 blur-2xl" />
              <motion.div className="pointer-events-none absolute inset-y-0 -inset-x-1/2 mix-blend-screen" style={{ x: sheenX, opacity: sheenOpacity, background: 'linear-gradient(115deg, transparent 36%, rgba(251,191,36,.12) 45%, rgba(253,230,138,.26) 50%, transparent 60%)' }} />
              <motion.div className="pointer-events-none absolute inset-0" style={{ background: glare }} />

              <div className="relative flex h-full flex-col p-[5.5cqw]">
                {/* Brand and tier */}
                <div className="flex items-center justify-between gap-[2cqw] border-b border-white/10 pb-[3cqw]">
                  <div className="flex min-w-0 items-center gap-[2.2cqw]">
                    <LogoMark size={36} tone="glass" className="size-[8cqw] shrink-0" />
                    <div className="min-w-0 leading-tight">
                      <div className="truncate text-[3.6cqw] font-bold">{t.meta.product}</div>
                      <div className="truncate text-[2.5cqw] text-on-primary-container">{t.card.brandLine}</div>
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-[1cqw] rounded-full px-[2.4cqw] py-[1cqw] text-[2.5cqw] font-bold" style={{ color: rim, background: `${rim}26` }}>
                    <BadgeCheck className="size-[3.4cqw]" />
                    {t.tiers.badge[data.tier]}
                  </span>
                </div>

                {/* Photo, name, classification — and the QR */}
                <div className="flex flex-1 items-center justify-between gap-[3cqw]">
                  <div className="flex min-w-0 items-center gap-[3.4cqw]">
                    <div className="size-[17cqw] shrink-0 rounded-[3.4cqw] bg-white/15 p-[0.8cqw] shadow-inner">
                      {data.photoUrl ? (
                        <img src={data.photoUrl} alt="" className="size-full rounded-[2.8cqw] object-cover" />
                      ) : (
                        <div className="grid size-full place-items-center rounded-[2.8cqw] bg-primary-container text-[6cqw] font-bold text-secondary-fixed-dim">{initials(data.name)}</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[2.4cqw] text-on-primary-container">{t.profile.nameLabel}</div>
                      <div className="flex items-center gap-[1.2cqw]">
                        <span className="truncate text-[4.8cqw] leading-tight font-bold">{data.name}</span>
                        {data.verified && <CircleCheck className="size-[4cqw] shrink-0 text-secondary-fixed-dim" aria-label={t.profile.verified} />}
                      </div>
                      <div className="mt-[0.8cqw] truncate text-[2.7cqw] text-on-primary-container">
                        {t.card.classification}: {data.classification || t.tiers.role[data.tier]}
                      </div>
                      <div className="mt-[0.6cqw] flex items-center gap-[1cqw] text-[2.5cqw] text-white/70">
                        <MapPin className="size-[2.8cqw]" />
                        <span className="truncate">{data.city}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-[0.8cqw] rounded-[2.4cqw] bg-white p-[1.4cqw] shadow-lg">
                    <img src={qrSrc} alt={qrHint} className="size-[15cqw]" />
                    <span className="text-[2cqw] font-semibold text-primary-container">{t.card.scanToVerify}</span>
                  </div>
                </div>

                {/* Member number and validity */}
                <div className="flex items-end justify-between gap-[2cqw]">
                  <div className="min-w-0">
                    <div className="text-[2.4cqw] text-on-primary-container">{t.card.memberNo}</div>
                    <div className="code-id text-[6.4cqw] leading-none font-bold text-secondary-fixed-dim">{fmtCode(data.code)}</div>
                  </div>
                  <div className="text-end text-[2.4cqw] leading-relaxed text-on-primary-container">
                    <div className="flex items-center justify-end gap-[1cqw]">
                      <span className="size-[1.6cqw] rounded-full bg-emerald-400" />
                      {t.card.active}
                    </div>
                    <div>
                      {t.card.memberSince} <span className="code-id tracking-normal">{since}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Back: a large QR for scanning straight from the phone screen. */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl border border-line bg-white text-primary-container shadow-xl [backface-visibility:hidden] [container-type:inline-size] [transform:rotateY(180deg)]">
              <div className="flex h-full items-center gap-[5cqw] p-[5.5cqw]">
                <div className="aspect-square h-full rounded-[3cqw] border border-line bg-white p-[2cqw]">
                  <img src={qrSrc} alt={qrHint} className="size-full" />
                </div>
                <div className="min-w-0 flex-1 space-y-[2cqw]">
                  <div className="text-[3cqw] text-muted">{qrHint}</div>
                  <div className="code-id text-[6.4cqw] font-bold">{fmtCode(data.code)}</div>
                  <div className="truncate text-[3.6cqw] font-semibold">{data.name}</div>
                  <div className="text-[2.6cqw] text-muted">
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
          <button type="button" onClick={() => setFlipped((f) => !f)} className="press inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface-container-lowest px-3.5 py-2 text-label-md text-on-surface-variant shadow-sm hover:bg-surface-container-low hover:text-on-surface">
            <RefreshCw className="size-4" />
            {t.card.flip}
          </button>
          {gyro === 'needs-permission' && (
            <button type="button" onClick={enableGyro} className="press rounded-xl border border-line bg-surface-container-lowest px-3.5 py-2 text-label-md text-on-surface-variant shadow-sm hover:bg-surface-container-low">
              {t.card.enableMotion}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
