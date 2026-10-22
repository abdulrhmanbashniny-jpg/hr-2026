'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { BadgeCheck, CircleAlert, Copy, KeyRound, MessageCircle, Trash2 } from 'lucide-react';
import { adjustPointsAction, confirmPhoneAction, removeCraftsmanPhotoAction, resetPasswordAction, setTierAction } from '@/app/admin/actions';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { f } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';
import { useConsole } from './console-i18n';

export function TierForm({ craftsmanId, tier }: { craftsmanId: string; tier: 'A' | 'B' | 'C' }) {
  const { t } = useI18n();
  const c = useConsole();
  const toast = useToast();
  const router = useRouter();
  const [value, setValue] = useState(tier);
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {(['A', 'B', 'C'] as const).map((x) => (
          <button key={x} type="button" onClick={() => setValue(x)} className={cn('press rounded-xl border px-2 py-2.5 text-xs font-medium', value === x ? 'border-navy-900 bg-navy-900 text-white dark:border-navy-200 dark:bg-navy-200 dark:text-navy-950' : 'border-line text-ink-2')}>
            {t.tiers.short[x]}
          </button>
        ))}
      </div>
      <Field label={c.craftsmen.tierReason}>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
      </Field>
      <Button
        variant="primary"
        className="w-full"
        loading={pending}
        disabled={value === tier || reason.trim().length < 3}
        onClick={() =>
          start(async () => {
            const r = await setTierAction(craftsmanId, value, reason);
            toast(r.ok ? t.common.saved : r.error, r.ok ? 'success' : 'error');
            if (r.ok) router.refresh();
          })
        }
      >
        {c.craftsmen.saveTier}
      </Button>
    </div>
  );
}

export function AdjustForm({ craftsmanId }: { craftsmanId: string }) {
  const { t } = useI18n();
  const c = useConsole();
  const toast = useToast();
  const router = useRouter();
  const [points, setPoints] = useState('');
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const n = Number(points.replace(/[^\d-]/g, ''));
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">{c.craftsmen.adjustHint}</p>
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <Field label={c.craftsmen.adjustPoints}>
          <Input inputMode="numeric" dir="ltr" className="num" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="+500" />
        </Field>
        <Field label={c.craftsmen.adjustNote}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </Field>
      </div>
      <Button
        variant="secondary"
        className="w-full"
        loading={pending}
        disabled={!Number.isInteger(n) || n === 0 || note.trim().length < 3}
        onClick={() =>
          start(async () => {
            const r = await adjustPointsAction(craftsmanId, n, note);
            toast(r.ok ? t.common.saved : r.error, r.ok ? 'success' : 'error');
            if (r.ok) {
              setPoints('');
              setNote('');
              router.refresh();
            }
          })
        }
      >
        {c.craftsmen.adjustSave}
      </Button>
    </div>
  );
}

/** The card photo as staff see it, with removal for an unsuitable picture (the reason is audited). */
export function PhotoAdmin({ craftsmanId, name, photoUrl, canManage }: { craftsmanId: string; name: string; photoUrl: string | null; canManage: boolean }) {
  const c = useConsole();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-center gap-2">
      <Avatar name={name} src={photoUrl} size={112} className="rounded-2xl ring-2 ring-secondary/20" />
      {photoUrl && canManage ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const reason = prompt(c.craftsmen.removeReason);
            if (!reason || reason.trim().length < 3) return;
            start(async () => {
              const r = await removeCraftsmanPhotoAction(craftsmanId, reason.trim());
              if (r.ok) {
                toast(c.craftsmen.photoRemoved);
                router.refresh();
              } else toast(r.error, 'error');
            });
          }}
          className="press inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-label-sm text-[#EF4444] hover:bg-[rgb(239_68_68/0.06)] disabled:opacity-50"
        >
          <Trash2 className="size-3.5" />
          {c.craftsmen.removePhoto}
        </button>
      ) : (
        !photoUrl && <span className="text-label-sm text-muted">{c.craftsmen.noPhoto}</span>
      )}
    </div>
  );
}

/**
 * Account access without SMS: confirm the number once staff have reached the owner on it, and issue
 * a one-time password (shown once) to send to that number when the craftsman forgets theirs.
 */
export function AccessAdmin({ userId, phone, phoneVerified, canManage, brand, appUrl }: { userId: string; phone: string; phoneVerified: boolean; canManage: boolean; brand: string; appUrl: string }) {
  const c = useConsole();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [temp, setTemp] = useState<string | null>(null);
  const waDigits = phone.replace(/^\+/, '');
  const message = temp ? f(c.craftsmen.whatsappMessage, { brand, password: temp, url: `${appUrl}/login` }) : '';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn('inline-flex items-center gap-1.5 text-label-md font-semibold', phoneVerified ? 'text-[#047857]' : 'text-warning')}>
          {phoneVerified ? <BadgeCheck className="size-4" /> : <CircleAlert className="size-4" />}
          {phoneVerified ? c.craftsmen.phoneConfirmed : c.craftsmen.phoneUnconfirmed}
        </span>
        {canManage && (
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await confirmPhoneAction(userId, !phoneVerified);
                if (r.ok) router.refresh();
                else toast(r.error, 'error');
              })
            }
          >
            {phoneVerified ? c.craftsmen.unconfirmPhone : c.craftsmen.confirmPhone}
          </Button>
        )}
      </div>
      {!phoneVerified && <p className="text-body-sm text-muted">{c.craftsmen.phoneHelp}</p>}

      {canManage && !temp && (
        <Button
          variant="secondary"
          size="sm"
          icon={<KeyRound className="size-4" />}
          loading={pending}
          onClick={() => {
            if (!confirm(c.craftsmen.resetConfirm)) return;
            start(async () => {
              const r = await resetPasswordAction(userId);
              if (r.ok) setTemp(r.password);
              else toast(r.error, 'error');
            });
          }}
        >
          {c.craftsmen.resetPassword}
        </Button>
      )}

      {temp && (
        <div className="space-y-2 rounded-xl border border-dashed border-accent bg-accent-soft p-3">
          <div className="text-label-md font-semibold text-primary">{c.craftsmen.tempTitle}</div>
          <div className="num select-all text-center text-headline-sm tracking-[0.15em] text-ink" dir="ltr">
            {temp}
          </div>
          <p className="text-body-sm text-muted">{c.craftsmen.tempHelp}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Copy className="size-4" />}
              onClick={() => navigator.clipboard?.writeText(temp).then(() => toast(c.craftsmen.copied), () => undefined)}
            >
              {c.craftsmen.copy}
            </Button>
            <a
              href={`https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="press inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#047857] px-3 text-label-md text-white hover:brightness-110"
            >
              <MessageCircle className="size-4" />
              {c.craftsmen.sendWhatsapp}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
