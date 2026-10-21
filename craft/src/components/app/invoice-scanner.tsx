'use client';

import { useQuery } from '@tanstack/react-query';
import { Camera, CircleCheck, CircleX, Hourglass, ImageUp, Lightbulb, LoaderCircle, QrCode, RotateCcw, ShieldAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { confetti } from '@/components/ui/confetti';
import { Field, Input } from '@/components/ui/field';
import { api, ApiClientError, deviceHint, uploadFile } from '@/lib/api-client';
import { blobToCanvas, detectQr, previewZatca, processInvoicePhoto } from '@/lib/media/client';
import { digitsOnly, normalizeDigits } from '@/lib/digits';
import { f, fmtNumber } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';

type Step = 'capture' | 'review' | 'submitting' | 'result';

interface InvoiceStatus {
  id: string;
  status: 'processing' | 'pending' | 'flagged' | 'approved' | 'rejected';
  pointsAwarded: number;
  reasons: string[];
}

export function InvoiceScanner() {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState<'off' | 'starting' | 'on' | 'denied'>('off');
  const [step, setStep] = useState<Step>('capture');
  const [qr, setQr] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [declared, setDeclared] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    setCamera((c) => (c === 'denied' ? c : 'off'));
  }, []);

  async function start() {
    setError(null);
    setCamera('starting');
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      if (video.current) {
        video.current.srcObject = stream.current;
        await video.current.play();
      }
      setCamera('on');
    } catch {
      setCamera('denied');
    }
  }

  // Look for the QR code a few times a second while the camera is live.
  useEffect(() => {
    if (camera !== 'on') return;
    let alive = true;
    const canvas = document.createElement('canvas');
    const tick = async () => {
      const v = video.current;
      if (!alive || !v || !v.videoWidth) return;
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      canvas.getContext('2d')!.drawImage(v, 0, 0);
      const found = await detectQr(canvas).catch(() => null);
      if (found && alive) setQr((prev) => prev ?? found);
      if (alive) setTimeout(tick, 350);
    };
    tick();
    return () => {
      alive = false;
    };
  }, [camera]);

  useEffect(() => stop, [stop]);

  async function acceptImage(blob: Blob, canvas?: HTMLCanvasElement) {
    const c = canvas ?? (await blobToCanvas(blob));
    const found = qr ?? (await detectQr(c).catch(() => null));
    setQr(found);
    const processed = await processInvoicePhoto(c);
    setPhoto(processed);
    setPreview(URL.createObjectURL(processed));
    const info = found ? previewZatca(found) : null;
    if (info?.total && !declared) setDeclared(info.total);
    stop();
    setStep('review');
  }

  async function capture() {
    const v = video.current;
    if (!v) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')!.drawImage(v, 0, 0);
    await acceptImage(new Blob(), canvas);
  }

  async function submit() {
    if (!photo) return;
    setStep('submitting');
    setError(null);
    try {
      const uploadId = await uploadFile('/invoices/upload', photo, setProgress);
      const amount = Number(digitsOnly(normalizeDigits(declared).replace(/[^\d.]/g, '').split('.')[0] ?? '')) || null;
      const res = await api<{ id: string }>('/invoices', { body: { uploadId, qrPayload: qr, declaredAmount: amount, fp: deviceHint() } });
      setInvoiceId(res.id);
      setStep('result');
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : t.errors.generic);
      setStep('review');
    }
  }

  const status = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => api<InvoiceStatus>(`/invoices/${invoiceId}`),
    enabled: !!invoiceId,
    refetchInterval: (q) => (q.state.data && q.state.data.status !== 'processing' ? false : 1500),
  });
  useEffect(() => {
    if (status.data?.status === 'approved') confetti();
  }, [status.data?.status]);

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setQr(null);
    setPhoto(null);
    setPreview(null);
    setDeclared('');
    setInvoiceId(null);
    setProgress(0);
    setStep('capture');
  }

  const info = qr ? previewZatca(qr) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="surface overflow-hidden p-0">
        <AnimatePresence mode="wait">
          {step === 'capture' && (
            <motion.div key="cap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative aspect-[3/4] bg-navy-950 sm:aspect-[4/3]">
              <video ref={video} playsInline muted className={`absolute inset-0 size-full object-cover ${camera === 'on' ? '' : 'hidden'}`} />
              {camera === 'on' ? (
                <>
                  <div className="pointer-events-none absolute inset-[8%] rounded-3xl border-2 border-white/60">
                    <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden">
                      <div className="h-0.5 w-full bg-accent-2 shadow-[0_0_12px_#fbbf24]" style={{ animation: 'scan-line 2s ease-in-out infinite alternate' }} />
                    </div>
                  </div>
                  <div className="absolute inset-x-0 top-4 flex justify-center">
                    <Badge tone={qr ? 'success' : 'neutral'} icon={qr ? <CircleCheck className="size-3.5" /> : <QrCode className="size-3.5" />} className="shadow-md">
                      {qr ? t.invoices.scanner.qrFound : t.invoices.scanner.qrMissing}
                    </Badge>
                  </div>
                  <div className="absolute inset-x-0 bottom-5 flex items-center justify-center gap-4">
                    <label className={buttonClass('secondary', 'icon', 'size-12 cursor-pointer rounded-full')} aria-label={t.invoices.scanner.gallery}>
                      <ImageUp className="size-5" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && acceptImage(e.target.files[0])} />
                    </label>
                    <button onClick={capture} aria-label={t.invoices.scanner.capture} className="press grid size-18 place-items-center rounded-full border-4 border-white bg-accent shadow-glow">
                      <Camera className="size-7 text-accent-ink" />
                    </button>
                    <div className="size-12" />
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center text-white">
                  <div className="grid size-16 place-items-center rounded-2xl bg-white/10">
                    <QrCode className="size-8 text-accent-2" />
                  </div>
                  <p className="max-w-xs text-sm text-white/75">{camera === 'denied' ? t.invoices.scanner.cameraDenied : t.invoices.scanner.hint}</p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {camera !== 'denied' && (
                      <Button variant="accent" onClick={start} loading={camera === 'starting'} icon={<Camera className="size-5" />}>
                        {t.invoices.scanner.camera}
                      </Button>
                    )}
                    <label className={buttonClass('secondary', 'md', 'cursor-pointer')}>
                      <ImageUp className="size-5" />
                      {t.invoices.scanner.gallery}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && acceptImage(e.target.files[0])} />
                    </label>
                  </div>
                </div>
              )}
            </motion.div>
          )}
          {(step === 'review' || step === 'submitting') && preview && (
            <motion.div key="rev" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative bg-navy-950">
              <img src={preview} alt="" className="mx-auto max-h-[70dvh] object-contain" />
              {step === 'submitting' && (
                <div className="absolute inset-x-0 bottom-0 bg-navy-950/80 p-4 text-white backdrop-blur">
                  <div className="mb-2 flex items-center gap-2 text-sm">
                    <LoaderCircle className="size-4 animate-spin" />
                    {t.invoices.scanner.uploading} <span className="num">{progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                    <div className="amber-gradient h-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </motion.div>
          )}
          {step === 'result' && (
            <motion.div key="res" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex min-h-80 flex-col items-center justify-center gap-4 p-8 text-center">
              <ResultIcon status={status.data?.status} />
              <h2 className="text-xl font-bold">
                {!status.data || status.data.status === 'processing'
                  ? t.invoices.scanner.processing
                  : status.data.status === 'approved'
                    ? f(t.invoices.scanner.approved, { points: fmtNumber(status.data.pointsAwarded) })
                    : t.invoices.scanner[status.data.status]}
              </h2>
              {status.data?.status === 'rejected' && status.data.reasons[0] && <p className="text-sm text-muted">{t.risk[status.data.reasons[0] as keyof typeof t.risk] ?? ''}</p>}
              <div className="flex gap-3">
                <Button variant="secondary" onClick={reset} icon={<RotateCcw className="size-4" />}>
                  {t.invoices.scan}
                </Button>
                <Link href="/app/invoices" className={buttonClass('primary')}>
                  {t.invoices.title}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-4">
        {step !== 'result' && (
          <div className="surface space-y-4 p-5">
            {info ? (
              <div className="rounded-xl bg-success-soft p-4">
                <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-success">
                  <CircleCheck className="size-4" />
                  {t.invoices.scanner.detected}
                </div>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t.invoices.seller}</dt>
                    <dd className="truncate text-ink">{info.seller}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">VAT</dt>
                    <dd className="num text-ink">{info.vat}</dd>
                  </div>
                  {info.total && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">{t.invoices.total}</dt>
                      <dd className="num font-semibold text-ink">{info.total}</dd>
                    </div>
                  )}
                </dl>
              </div>
            ) : step === 'review' ? (
              <div className="flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                {t.risk.qr_missing}
              </div>
            ) : null}
            {step !== 'capture' && (
              <>
                <Field label={t.invoices.scanner.declared} htmlFor="declared">
                  <Input id="declared" inputMode="decimal" className="num" value={declared} onChange={(e) => setDeclared(e.target.value)} placeholder="0.00" />
                </Field>
                {error && <p className="text-sm text-danger">{error}</p>}
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={reset} disabled={step === 'submitting'} icon={<RotateCcw className="size-4" />}>
                    {t.invoices.scanner.retake}
                  </Button>
                  <Button variant="accent" className="flex-1" onClick={submit} loading={step === 'submitting'}>
                    {t.invoices.scanner.submit}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
        <div className="surface p-5">
          <div className="mb-3 flex items-center gap-2 font-semibold text-ink">
            <Lightbulb className="size-4 text-accent" />
            {t.invoices.subtitle}
          </div>
          <ul className="space-y-2 text-sm text-ink-2">
            {t.invoices.scanner.tips.map((tip) => (
              <li key={tip} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ResultIcon({ status }: { status?: InvoiceStatus['status'] }) {
  if (!status || status === 'processing')
    return (
      <div className="grid size-16 place-items-center rounded-2xl bg-surface-2">
        <LoaderCircle className="size-8 animate-spin text-accent" />
      </div>
    );
  if (status === 'approved')
    return (
      <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="amber-gradient grid size-16 place-items-center rounded-2xl text-accent-ink shadow-glow">
        <CircleCheck className="size-8" />
      </motion.div>
    );
  if (status === 'rejected')
    return (
      <div className="grid size-16 place-items-center rounded-2xl bg-danger-soft text-danger">
        <CircleX className="size-8" />
      </div>
    );
  return (
    <div className="grid size-16 place-items-center rounded-2xl bg-info-soft text-info">
      <Hourglass className="size-8" />
    </div>
  );
}
