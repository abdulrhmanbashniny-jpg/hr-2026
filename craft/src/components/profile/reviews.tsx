'use client';

import { CircleCheck, MessageSquareQuote, PenLine, Star } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { api, ApiClientError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import type { PublicProfile } from '@/lib/craftsmen/public';
import { f, fmtDate } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';
import { profileStrings, type ProfileStrings } from '@/lib/i18n/pages/profile';
import { Stars } from './stars';

type Errors = Partial<Record<'authorName' | 'rating' | 'body' | 'form', string>>;

function ReviewForm({ code, s, onClose }: { code: string; s: ProfileStrings; onClose: () => void }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const [authorName, setAuthorName] = useState('');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState('');
  const [projectLabel, setProjectLabel] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (authorName.trim().length < 2) next.authorName = s.reviews.form.nameShort;
    if (rating < 1) next.rating = s.reviews.form.ratingRequired;
    if (body.trim().length < 10) next.body = s.reviews.form.bodyShort;
    setErrors(next);
    if (Object.keys(next).length) return;
    setSending(true);
    try {
      await api(`/craftsmen/${code}/reviews`, { body: { authorName: authorName.trim(), rating, body: body.trim(), projectLabel: projectLabel.trim() || null } });
      setDone(true);
    } catch (err) {
      setErrors({ form: err instanceof ApiClientError ? err.message : t.errors.generic });
    } finally {
      setSending(false);
    }
  }

  if (done)
    return (
      <motion.div initial={reduced ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }} className="flex flex-col items-center py-space-md text-center">
        <div className="mb-space-md grid size-16 place-items-center rounded-full bg-[rgb(16_185_129/0.1)] text-[#047857]">
          <CircleCheck className="size-8" />
        </div>
        <h3 className="mb-1 text-headline-sm text-primary">{s.reviews.form.doneTitle}</h3>
        <p className="mb-space-lg max-w-sm text-body-md text-on-surface-variant">{s.reviews.form.doneBody}</p>
        <Button onClick={onClose} className="min-w-32">
          {s.reviews.form.done}
        </Button>
      </motion.div>
    );

  const shown = hover || rating;
  return (
    <form onSubmit={submit} noValidate className="space-y-space-md">
      <p className="text-body-sm text-on-surface-variant">{s.reviews.form.intro}</p>
      <fieldset>
        <legend className="mb-1.5 text-label-md font-semibold text-primary-container">{s.reviews.form.rating}</legend>
        <div className="flex flex-wrap items-center gap-space-sm">
          <div className="flex items-center gap-1" role="radiogroup" aria-label={s.reviews.form.rating} onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${f(s.reviews.stars, { n })} — ${s.reviews.form.starLabels[n - 1]}`}
                onClick={() => {
                  setRating(n);
                  setErrors((x) => ({ ...x, rating: undefined }));
                }}
                onMouseEnter={() => setHover(n)}
                onKeyDown={(e) => {
                  const dir = document.dir === 'rtl' ? -1 : 1;
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const step = (e.key === 'ArrowRight' ? 1 : -1) * dir;
                    setRating((r) => Math.max(1, Math.min(5, (r || 0) + step)));
                  }
                }}
                className="press grid size-11 place-items-center rounded-xl transition hover:bg-secondary-fixed/40"
              >
                <Star className={cn('size-8 transition-colors', n <= shown ? 'fill-secondary-container text-secondary-container' : 'text-outline-variant')} />
              </button>
            ))}
          </div>
          <span className="min-w-16 text-label-md text-on-surface-variant" aria-hidden>
            {shown ? s.reviews.form.starLabels[shown - 1] : ''}
          </span>
        </div>
        {errors.rating && <p className="mt-1 text-[13px] text-danger">{errors.rating}</p>}
      </fieldset>
      <Field label={s.reviews.form.name} htmlFor="rv-name" error={errors.authorName}>
        <Input id="rv-name" value={authorName} onChange={(e) => setAuthorName(e.target.value.slice(0, 60))} placeholder={s.reviews.form.namePlaceholder} autoComplete="name" aria-invalid={!!errors.authorName || undefined} />
      </Field>
      <Field label={s.reviews.form.body} htmlFor="rv-body" error={errors.body} hint={s.reviews.form.bodyHint}>
        <Textarea id="rv-body" value={body} onChange={(e) => setBody(e.target.value.slice(0, 600))} placeholder={s.reviews.form.bodyPlaceholder} rows={4} aria-invalid={!!errors.body || undefined} />
      </Field>
      <Field label={`${s.reviews.form.project} (${t.common.optional})`} htmlFor="rv-project">
        <Input id="rv-project" value={projectLabel} onChange={(e) => setProjectLabel(e.target.value.slice(0, 80))} placeholder={s.reviews.form.projectPlaceholder} />
      </Field>
      {errors.form && <p className="rounded-xl bg-[rgb(239_68_68/0.08)] px-space-md py-space-sm text-body-sm text-danger">{errors.form}</p>}
      <div className="flex flex-col-reverse gap-space-sm pt-space-xs sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          {s.reviews.form.cancel}
        </Button>
        <Button type="submit" variant="accent" loading={sending} icon={<PenLine className="size-[18px]" />}>
          {s.reviews.form.submit}
        </Button>
      </div>
    </form>
  );
}

/** "آراء وتجارب العملاء الموثقة": published reviews in a three-up grid, and a form to add one (held for moderation). */
export function ReviewsSection({ code, name, reviews }: { code: string; name: string; reviews: PublicProfile['reviews'] }) {
  const { locale } = useI18n();
  const s = profileStrings(locale);
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  return (
    <section className="mb-space-lg rounded-2xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-lg" aria-labelledby="reviews-title">
      <div className="mb-space-lg flex flex-col justify-between gap-space-md md:flex-row md:items-center">
        <div className="flex items-start gap-space-xs">
          <MessageSquareQuote className="mt-0.5 size-6 shrink-0 text-secondary" aria-hidden />
          <div>
            <h2 id="reviews-title" className="text-headline-md text-primary">
              {s.reviews.title}
            </h2>
            <p className="max-w-2xl text-body-sm text-on-surface-variant">{s.reviews.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-space-md md:shrink-0">
          {reviews.count > 0 && reviews.average !== null && (
            <div className="flex items-center gap-space-xs text-label-md text-on-surface">
              <span className="num text-headline-sm text-primary">{reviews.average.toFixed(1)}</span>
              <Stars value={reviews.average} size={14} label={f(s.reviews.stars, { n: reviews.average.toFixed(1) })} />
              <span className="text-on-surface-variant">· {s.reviews.total(reviews.count)}</span>
            </div>
          )}
          <Button
            variant="primary"
            size="md"
            icon={<PenLine className="size-[18px]" />}
            onClick={() => {
              setFormKey((k) => k + 1);
              setOpen(true);
            }}
          >
            {s.reviews.add}
          </Button>
        </div>
      </div>

      {reviews.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-surface-container-low px-space-lg py-space-xl text-center">
          <div className="mb-space-md grid size-14 place-items-center rounded-full bg-secondary-fixed/50 text-secondary">
            <MessageSquareQuote className="size-7" />
          </div>
          <p className="mb-1 text-headline-sm text-primary">{s.reviews.empty}</p>
          <p className="max-w-sm text-body-sm text-on-surface-variant">{s.reviews.emptyBody}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-space-md md:grid-cols-2 lg:grid-cols-3">
          {reviews.items.map((r) => (
            <li key={r.id} className="flex flex-col justify-between rounded-xl bg-surface-container-low p-space-md">
              <div>
                <div className="mb-space-xs flex items-center justify-between gap-space-sm">
                  <span className="truncate text-label-md font-bold text-primary">{r.authorName}</span>
                  <Stars value={r.rating} size={16} label={f(s.reviews.stars, { n: r.rating })} className="shrink-0" />
                </div>
                <blockquote className="mb-space-sm text-body-md text-on-surface">“{r.body}”</blockquote>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-space-sm gap-y-1 pt-space-xs text-label-sm text-on-surface-variant">
                <span>{r.projectLabel ? f(s.reviews.project, { label: r.projectLabel }) : fmtDate(r.createdAt, locale)}</span>
                {r.contacted && (
                  <span className="inline-flex items-center gap-1 font-medium text-secondary">
                    <CircleCheck className="size-3.5" aria-hidden />
                    {s.reviews.contacted}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title={f(s.reviews.form.title, { name })}>
        <ReviewForm key={formKey} code={code} s={s} onClose={() => setOpen(false)} />
      </Dialog>
    </section>
  );
}
