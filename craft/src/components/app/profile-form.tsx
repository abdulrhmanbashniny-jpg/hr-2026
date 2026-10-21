'use client';

import { Download, FileCheck2, IdCard, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, type Tone } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Switch } from '@/components/ui/controls';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api, ApiClientError, uploadFile } from '@/lib/api-client';
import type { Catalogue } from '@/lib/catalogue';
import { cn } from '@/lib/cn';
import { isValidSaudiId } from '@/lib/ids';
import { processInvoicePhoto } from '@/lib/media/client';
import { f, fmtDate } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';

type Check = 'unverified' | 'pending' | 'verified' | 'rejected';
const TONE: Record<Check, Tone> = { unverified: 'neutral', pending: 'info', verified: 'success', rejected: 'danger' };

export interface ProfileData {
  displayName: string;
  bio: string | null;
  cityId: string;
  trades: string[];
  yearsExperience: number;
  whatsapp: string | null;
  acceptsCalls: boolean;
  warrantyMonths: number;
  identityStatus: Check;
  nationalIdLast4: string | null;
  licenseStatus: Check;
  licenseNumber: string | null;
  deletionRequestedAt: string | null;
}

export function ProfileForm({ data, catalogue }: { data: ProfileData; catalogue: Pick<Catalogue, 'cities' | 'trades'> }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState({
    displayName: data.displayName,
    bio: data.bio ?? '',
    cityId: data.cityId,
    trades: data.trades,
    yearsExperience: String(data.yearsExperience),
    whatsapp: data.whatsapp ? `0${data.whatsapp.replace(/^\+966/, '')}` : '',
    acceptsCalls: data.acceptsCalls,
    warrantyMonths: String(data.warrantyMonths),
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api('/me/profile', {
        method: 'PATCH',
        body: {
          displayName: form.displayName,
          bio: form.bio || null,
          cityId: form.cityId,
          trades: form.trades,
          yearsExperience: Number(form.yearsExperience) || 0,
          whatsapp: form.whatsapp || null,
          acceptsCalls: form.acceptsCalls,
          warrantyMonths: Number(form.warrantyMonths) || 0,
        },
      });
      toast(t.common.saved);
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : t.errors.generic, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <CardHeader title={t.profileEdit.public} />
        <Field label={t.profileEdit.displayName}>
          <Input value={form.displayName} onChange={(e) => setForm((x) => ({ ...x, displayName: e.target.value }))} maxLength={60} />
        </Field>
        <Field label={t.profileEdit.bio}>
          <Textarea value={form.bio} onChange={(e) => setForm((x) => ({ ...x, bio: e.target.value }))} placeholder={t.profileEdit.bioPlaceholder} maxLength={600} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t.onboarding.city}>
            <Select value={form.cityId} onChange={(e) => setForm((x) => ({ ...x, cityId: e.target.value }))}>
              {catalogue.cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {locale === 'ar' ? c.nameAr : c.nameEn}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.onboarding.years}>
            <Input inputMode="numeric" className="num" value={form.yearsExperience} onChange={(e) => setForm((x) => ({ ...x, yearsExperience: e.target.value.replace(/\D/g, '').slice(0, 2) }))} />
          </Field>
          <Field label={t.profileEdit.warranty}>
            <Input inputMode="numeric" className="num" value={form.warrantyMonths} onChange={(e) => setForm((x) => ({ ...x, warrantyMonths: e.target.value.replace(/\D/g, '').slice(0, 3) }))} />
          </Field>
        </div>
        <Field label={t.trades.label}>
          <div className="flex flex-wrap gap-2">
            {catalogue.trades.map((tr) => {
              const on = form.trades.includes(tr.id);
              return (
                <button
                  key={tr.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setForm((x) => ({ ...x, trades: on ? x.trades.filter((v) => v !== tr.id) : [...x.trades, tr.id].slice(0, 8) }))}
                  className={cn('press rounded-xl border px-3 py-2 text-sm', on ? 'border-navy-900 bg-navy-900 text-white dark:border-navy-200 dark:bg-navy-200 dark:text-navy-950' : 'border-line bg-surface text-ink-2')}
                >
                  {locale === 'ar' ? tr.nameAr : tr.nameEn}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label={t.profileEdit.whatsapp}>
          <Input inputMode="tel" className="num" dir="ltr" value={form.whatsapp} onChange={(e) => setForm((x) => ({ ...x, whatsapp: e.target.value }))} placeholder="05XXXXXXXX" />
        </Field>
        <Switch checked={form.acceptsCalls} onChange={(v) => setForm((x) => ({ ...x, acceptsCalls: v }))} label={t.profileEdit.acceptsCalls} />
        <div className="flex justify-end border-t border-line pt-4">
          <Button variant="accent" onClick={save} loading={saving} disabled={form.displayName.trim().length < 2}>
            {t.common.save}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title={t.profileEdit.verification} icon={<ShieldCheck className="size-5" />} />
        <div className="grid gap-4 lg:grid-cols-2">
          <VerificationBox kind="national_id" status={data.identityStatus} hint={data.nationalIdLast4 ? `•••• ${data.nationalIdLast4}` : null} />
          <VerificationBox kind="freelance_license" status={data.licenseStatus} hint={data.licenseNumber} />
        </div>
      </Card>

      <Card>
        <CardHeader title={t.profileEdit.privacy} subtitle={t.profileEdit.privacyBody} />
        <div className="flex flex-wrap gap-3">
          <a href="/api/v1/me/export" className={buttonClass('secondary')}>
            <Download className="size-4" />
            {t.profileEdit.export}
          </a>
          {data.deletionRequestedAt ? (
            <Badge tone="warning">{f(t.profileEdit.deleteRequested, { date: fmtDate(data.deletionRequestedAt, locale) })}</Badge>
          ) : (
            <Button
              variant="danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (!confirm(t.profileEdit.deleteConfirm)) return;
                await api('/me/deletion', { body: {} });
                router.refresh();
              }}
            >
              {t.profileEdit.deleteRequest}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function VerificationBox({ kind, status, hint }: { kind: 'national_id' | 'freelance_license'; status: Check; hint: string | null }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const id = kind === 'national_id';
  const invalid = id && number.length >= 10 && !isValidSaudiId(number);
  const ready = file && (id ? isValidSaudiId(number) : number.trim().length >= 3 && expiry);

  async function submit() {
    if (!file) return;
    setBusy(true);
    try {
      const blob = file.type === 'application/pdf' ? file : await processInvoicePhoto(file);
      const uploadId = await uploadFile('/me/documents/upload', blob);
      await api('/me/verification', { body: id ? { kind, uploadId, nationalId: number } : { kind, uploadId, licenseNumber: number, expiresOn: expiry } });
      toast(t.profileEdit.statuses.pending);
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : t.errors.generic, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium text-ink">
          {id ? <IdCard className="size-5 text-muted" /> : <FileCheck2 className="size-5 text-muted" />}
          {id ? t.profileEdit.nationalId : t.profileEdit.license}
        </div>
        <Badge tone={TONE[status]}>{t.profileEdit.statuses[status]}</Badge>
      </div>
      {hint && <div className="num mb-3 text-sm text-muted">{hint}</div>}
      {(status === 'unverified' || status === 'rejected') && (
        <div className="space-y-3">
          <Field label={id ? t.profileEdit.nationalId : t.profileEdit.licenseNumber} error={invalid ? t.profileEdit.nationalIdInvalid : undefined}>
            <Input inputMode={id ? 'numeric' : 'text'} className="num" value={number} onChange={(e) => setNumber(e.target.value.slice(0, 20))} aria-invalid={invalid} />
          </Field>
          {!id && (
            <Field label={t.profileEdit.licenseExpiry}>
              <Input type="date" className="num" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </Field>
          )}
          <label className={buttonClass('secondary', 'md', 'w-full cursor-pointer')}>
            <Upload className="size-4" />
            <span className="truncate">{file?.name ?? (id ? t.profileEdit.idDocument : t.profileEdit.licenseDocument)}</span>
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <Button variant="primary" className="w-full" onClick={submit} loading={busy} disabled={!ready}>
            {t.profileEdit.submitVerification}
          </Button>
        </div>
      )}
    </div>
  );
}
