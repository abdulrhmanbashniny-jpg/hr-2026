'use client';

import { Calculator, PaintBucket } from 'lucide-react';
import { useMemo, useState } from 'react';
import { WhatsAppIcon } from '@/components/brand/icons';
import { Button } from '@/components/ui/button';
import { Segmented, Switch } from '@/components/ui/controls';
import { Field, Input, Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api, ApiClientError } from '@/lib/api-client';
import { estimatePaint, type PaintKind } from '@/lib/estimator';
import { fmtNumber } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';

export function Estimator({ code }: { code: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [mode, setMode] = useState<'room' | 'area'>('room');
  const [room, setRoom] = useState({ length: '5', width: '4', height: '3' });
  const [area, setArea] = useState('60');
  const [ceiling, setCeiling] = useState(true);
  const [openings, setOpenings] = useState('4');
  const [coats, setCoats] = useState(2);
  const [kind, setKind] = useState<PaintKind>('interior');
  const [primer, setPrimer] = useState(true);
  const [sending, setSending] = useState(false);

  const input = useMemo(() => {
    const n = (v: string) => Math.max(0, Number(v) || 0);
    return {
      ...(mode === 'room' ? { room: { length: n(room.length), width: n(room.width), height: n(room.height), includeCeiling: ceiling } } : { areaSqm: n(area) }),
      openingsSqm: n(openings),
      coats,
      kind,
      primer,
    };
  }, [mode, room, area, ceiling, openings, coats, kind, primer]);
  const est = estimatePaint(input);

  async function send() {
    setSending(true);
    try {
      const r = await api<{ whatsappUrl: string }>(`/craftsmen/${code}/estimate`, { body: input });
      window.open(r.whatsappUrl, '_blank', 'noopener');
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : t.errors.generic, 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="h-full overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm">
      <div className="flex items-center gap-space-sm border-b border-line p-space-md sm:px-space-lg">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary-fixed/40 text-secondary">
          <Calculator className="size-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-headline-sm text-primary">{t.estimator.title}</h3>
          <p className="text-body-sm text-on-surface-variant">{t.estimator.subtitle}</p>
        </div>
      </div>
      <div className="grid gap-space-lg p-space-md sm:p-space-lg md:grid-cols-[1.2fr_1fr]">
        <div className="min-w-0 space-y-space-md">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'room', label: t.estimator.byRoom },
              { value: 'area', label: t.estimator.byArea },
            ]}
          />
          {mode === 'room' ? (
            <div className="grid grid-cols-3 gap-space-sm">
              {(['length', 'width', 'height'] as const).map((k) => (
                <Field key={k} label={t.estimator[k]}>
                  <Input inputMode="decimal" className="num" value={room[k]} onChange={(e) => setRoom((r) => ({ ...r, [k]: e.target.value }))} />
                </Field>
              ))}
            </div>
          ) : (
            <Field label={t.estimator.area}>
              <Input inputMode="decimal" className="num" value={area} onChange={(e) => setArea(e.target.value)} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-space-sm">
            <Field label={t.estimator.openings}>
              <Input inputMode="decimal" className="num" value={openings} onChange={(e) => setOpenings(e.target.value)} />
            </Field>
            <Field label={t.estimator.coats}>
              <Select value={coats} onChange={(e) => setCoats(Number(e.target.value))}>
                {[1, 2, 3].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t.estimator.kind}>
            <Select value={kind} onChange={(e) => setKind(e.target.value as PaintKind)}>
              {(Object.keys(t.estimator.kinds) as PaintKind[]).map((k) => (
                <option key={k} value={k}>
                  {t.estimator.kinds[k]}
                </option>
              ))}
            </Select>
          </Field>
          {mode === 'room' && <Switch checked={ceiling} onChange={setCeiling} label={t.estimator.ceiling} />}
          <Switch checked={primer} onChange={setPrimer} label={t.estimator.primer} />
        </div>
        <div className="vip-surface relative flex flex-col justify-between gap-space-md overflow-hidden rounded-2xl p-space-lg text-white">
          <div>
            <div className="text-label-md text-primary-fixed-dim">{t.estimator.result}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="num text-[44px] leading-none font-bold text-secondary-fixed-dim">{fmtNumber(est.liters, 1)}</span>
              <span className="text-body-md text-primary-fixed-dim">{t.estimator.liters}</span>
            </div>
            <div className="mt-space-md space-y-2 text-body-md">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                <span className="text-primary-fixed-dim">{t.estimator.paintable}</span>
                <span className="num">{fmtNumber(est.paintableSqm, 1)} m²</span>
              </div>
              {est.buckets.big > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <PaintBucket className="size-4 text-secondary-fixed-dim" />
                    {t.estimator.big}
                  </span>
                  <span className="num">× {est.buckets.big}</span>
                </div>
              )}
              {est.buckets.small > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <PaintBucket className="size-3.5 text-secondary-fixed-dim" />
                    {t.estimator.small}
                  </span>
                  <span className="num">× {est.buckets.small}</span>
                </div>
              )}
              {primer && est.primerLiters > 0 && (
                <div className="flex items-center justify-between gap-2 text-white/80">
                  <span>{t.estimator.primerLine}</span>
                  <span className="num">
                    {fmtNumber(est.primerLiters, 1)} {t.estimator.liters}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div>
            <Button variant="whatsapp" className="w-full" loading={sending} onClick={send} icon={<WhatsAppIcon className="size-5" />} disabled={est.liters <= 0}>
              {t.estimator.send}
            </Button>
            <p className="mt-space-sm text-body-sm text-white/60">{t.estimator.disclaimer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
