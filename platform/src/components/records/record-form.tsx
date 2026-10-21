'use client';

import { ArrowRight, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition, type FormEvent } from 'react';
import { saveRecord } from '@/app/app/records-actions';
import { DateInput } from '@/components/ui/date-input';
import { Field } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { TEMPLATES } from '@/lib/imports/templates';
import { useI18n } from '@/lib/i18n/client';
import { RECORD_PATHS, type RecordKind } from '@/lib/records/meta';

export type RecordValues = Record<string, string | boolean | null>;

/**
 * The whole record on its own page, generated from the template definition: every column the
 * government file has. Submitting does not reset the form, so a validation error keeps what was typed.
 */
export function RecordFormPanel({ kind, id, initial }: { kind: RecordKind; id: string | null; initial: RecordValues }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const def = TEMPLATES[kind];
  const back = RECORD_PATHS[kind];
  const derived = new Set([...Object.values(def.companions), ...def.fields.flatMap((x) => (x.hijriField ? [x.hijriField] : []))]);
  const val = (k: string) => {
    const v = initial[k];
    return v === null || v === undefined || typeof v === 'boolean' ? '' : v;
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    start(async () => {
      const r = await saveRecord(kind, id, null, form);
      if (!r.ok) {
        toast(r.error, 'err');
        return;
      }
      toast(r.message ?? t.common.saved, 'ok');
      router.push(back);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="record-form">
      <section className="ui-card">
        <p className="mb-5 text-sm text-muted">{t.records.manualHint}</p>
        <div className="record-form__grid">
          {def.fields
            .filter((fd) => !derived.has(fd.field))
            .map((fd) => {
              const label = locale === 'ar' ? fd.labelAr : fd.labelEn;
              const fid = `rec-${kind}-${fd.field}`;
              return (
                <Field key={fd.field} label={label} htmlFor={fid} required={fd.required}>
                  {fd.type === 'date' || fd.type === 'hijriDate' ? (
                    <DateInput id={fid} name={fd.field} defaultValue={val(fd.field).slice(0, 10) || null} required={fd.required} />
                  ) : fd.type === 'bool' ? (
                    <label className="flex min-h-[44px] items-center gap-2">
                      <input id={fid} type="checkbox" name={fd.field} defaultChecked={initial[fd.field] === true} className="ui-check" />
                      <span className="text-sm">{label}</span>
                    </label>
                  ) : (
                    <input
                      id={fid}
                      name={fd.field}
                      defaultValue={val(fd.field)}
                      required={fd.required}
                      inputMode={fd.type === 'id' || fd.type === 'int' || fd.type === 'money' ? 'decimal' : undefined}
                      className={`ui-input ${fd.type === 'text' ? '' : 'ui-input--ltr ui-num'}`}
                      autoFocus={fd.field === def.keyField && !id}
                    />
                  )}
                </Field>
              );
            })}
          {kind === 'gosi' ? (
            <Field label={t.records.probation} htmlFor="rec-probation">
              <select id="rec-probation" name="probationDays" defaultValue={val('probationDays')} className="ui-select">
                <option value="">{t.records.probationNone}</option>
                <option value="90">{t.records.probation90}</option>
                <option value="180">{t.records.probation180}</option>
              </select>
            </Field>
          ) : null}
          {kind === 'vehicles' ? (
            <Field label={t.fleet.opCardRequirement} htmlFor="rec-opreq">
              <select id="rec-opreq" name="operatingCardRequirement" defaultValue={val('operatingCardRequirement') || 'auto'} className="ui-select">
                <option value="auto">{t.fleet.opCardAuto}</option>
                <option value="required">{t.fleet.opCardForce}</option>
                <option value="exempt">{t.fleet.opCardExempt}</option>
              </select>
            </Field>
          ) : null}
        </div>
      </section>

      <div className="record-form__bar">
        <Link href={back} className="ui-btn ui-btn--ghost">
          <ArrowRight size={18} className="icon-back" />
          {t.common.cancel}
        </Link>
        <button type="submit" className="ui-btn ui-btn--primary" disabled={pending} aria-busy={pending || undefined}>
          {pending ? <span className="ui-spinner" /> : <Save size={18} />}
          {id ? t.common.save : t.records.add}
        </button>
      </div>
    </form>
  );
}
