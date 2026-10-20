'use client';

import { Archive, RefreshCw, Undo2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { archiveRecord, restoreRecord, updateRecord, type RecordKind } from '@/app/app/records-actions';
import { DateInput } from '@/components/ui/date-input';
import { Field, SubmitButton, useFeedbackAction } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/lib/i18n/client';

export type EditorField =
  | { name: string; label: string; type: 'date'; value: string | null }
  | { name: string; label: string; type: 'bool'; value: boolean }
  | { name: string; label: string; type: 'select'; value: string; options: { value: string; label: string }[] };

export function RecordEditor({ kind, id, title, hint, fields, canEdit }: { kind: RecordKind; id: string; title: string; hint?: string; fields: EditorField[]; canEdit: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [, action] = useFeedbackAction(updateRecord.bind(null, kind, id), () => setOpen(false));
  if (!canEdit) return null;
  return (
    <>
      <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setOpen(true)}>
        <RefreshCw size={16} />
        {t.common.update}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <form action={action} className="flex flex-col gap-3.5">
          {hint ? <p className="text-sm text-muted">{hint}</p> : null}
          {fields.map((fl) => (
            <Field key={fl.name} label={fl.label} htmlFor={`${id}-${fl.name}`}>
              {fl.type === 'date' ? (
                <DateInput id={`${id}-${fl.name}`} name={fl.name} defaultValue={fl.value} />
              ) : fl.type === 'bool' ? (
                <label className="flex items-center gap-2">
                  <input type="hidden" name={`${fl.name}__present`} value="1" />
                  <input id={`${id}-${fl.name}`} type="checkbox" name={fl.name} defaultChecked={fl.value} className="ui-check" />
                  <span>{fl.label}</span>
                </label>
              ) : (
                <select id={`${id}-${fl.name}`} name={fl.name} defaultValue={fl.value} className="ui-select">
                  {fl.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ))}
          <div className="ui-modal__foot" style={{ margin: '0 -20px -20px' }}>
            <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </button>
            <SubmitButton>{t.common.save}</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function ArchiveButton({ kind, id, name, canEdit, isVehicle }: { kind: RecordKind; id: string; name: string; canEdit: boolean; isVehicle?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [, action] = useFeedbackAction(archiveRecord.bind(null, kind, id), () => setOpen(false));
  if (!canEdit) return null;
  const reasons = isVehicle ? (['vehicle_sold', 'other'] as const) : (['sponsorship_transfer', 'final_exit', 'ended', 'other'] as const);
  return (
    <>
      <button type="button" className="ui-btn ui-btn--danger ui-btn--sm" onClick={() => setOpen(true)}>
        <Archive size={16} />
        {t.residents.archive}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.residents.archiveTitle.replace('{name}', name)}>
        <form action={action} className="flex flex-col gap-3.5">
          <p className="text-sm text-muted">{t.residents.archiveHint}</p>
          <Field label={t.common.reason} htmlFor={`${id}-reason`}>
            <select id={`${id}-reason`} name="reason" className="ui-select">
              {reasons.map((r) => (
                <option key={r} value={r}>
                  {t.residents.reasons[r]}
                </option>
              ))}
            </select>
          </Field>
          <div className="ui-modal__foot" style={{ margin: '0 -20px -20px' }}>
            <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </button>
            <SubmitButton variant="danger">{t.residents.archive}</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function RestoreButton({ kind, id, canEdit }: { kind: RecordKind; id: string; canEdit: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const [pending, start] = useTransition();
  if (!canEdit) return null;
  return (
    <button
      type="button"
      className="ui-btn ui-btn--ghost ui-btn--sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await restoreRecord(kind, id);
          toast(r.ok ? (r.message ?? t.settings.saved) : r.error, r.ok ? 'ok' : 'err');
        })
      }
    >
      <Undo2 size={16} />
      {t.residents.restore}
    </button>
  );
}
