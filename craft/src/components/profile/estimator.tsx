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
    <div className="surface overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line p-5">
        <div className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
          <Calculator className="size-5" />
        </div>
        <div>
          <h3 className="font-semibold">{t.estimator.title}</h3>
          <p className="text-sm text-muted">{t.estimator.subtitle}</p>
        </div>
      </div>
      <div className="grid gap-6 p-5 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'room', label: t.estimator.byRoom },
              { value: 'area', label: t.estimator.byArea },
            ]}
          />
          {mode === 'room' ? (
            <div className="grid grid-cols-3 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
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
        <div className="flex flex-col justify-between gap-4 rounded-2xl bg-navy-900 p-5 text-white">
          <div>
            <div className="text-sm text-white/70">{t.estimator.result}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="num text-5xl font-semibold text-accent-2">{fmtNumber(est.liters, 1)}</span>
              <span className="text-white/70">{t.estimator.liters}</span>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                <span className="text-white/70">{t.estimator.paintable}</span>
                <span className="num">{fmtNumber(est.paintableSqm, 1)} m²</span>
              </div>
              {est.buckets.big > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <PaintBucket className="size-4 text-accent-2" />
                    {t.estimator.big}
                  </span>
                  <span className="num">× {est.buckets.big}</span>
                </div>
              )}
              {est.buckets.small > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <PaintBucket className="size-3.5 text-accent-2" />
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
            <p className="mt-2 text-xs leading-relaxed text-white/55">{t.estimator.disclaimer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
