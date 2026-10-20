'use client';

import { Archive, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import { archiveRecord, deleteRecord, loadRecord, restoreRecord, saveRecord, updateRecord, type RecordKind } from '@/app/app/records-actions';
import { Notice } from '@/components/ui/card';
import { TEMPLATES } from '@/lib/imports/templates';
import { f } from '@/lib/i18n/format';
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

const REASONS: Record<RecordKind, ('sponsorship_transfer' | 'final_exit' | 'vehicle_sold' | 'vehicle_scrapped' | 'card_cancelled' | 'ended' | 'other')[]> = {
  residents: ['sponsorship_transfer', 'final_exit', 'ended', 'other'],
  gosi: ['ended', 'sponsorship_transfer', 'final_exit', 'other'],
  vehicles: ['vehicle_sold', 'vehicle_scrapped', 'other'],
  operating_cards: ['card_cancelled', 'vehicle_sold', 'other'],
  driver_cards: ['card_cancelled', 'ended', 'other'],
};

export function ArchiveButton({ kind, id, name, canEdit, open: controlled, onClose }: { kind: RecordKind; id: string; name: string; canEdit: boolean; isVehicle?: boolean; open?: boolean; onClose?: () => void }) {
  const { t } = useI18n();
  const [own, setOwn] = useState(false);
  const open = controlled ?? own;
  const close = () => (onClose ? onClose() : setOwn(false));
  const [, action] = useFeedbackAction(archiveRecord.bind(null, kind, id), close);
  if (!canEdit) return null;
  const reasons = REASONS[kind];
  return (
    <>
      {controlled === undefined ? (
        <button type="button" className="ui-btn ui-btn--danger ui-btn--sm" onClick={() => setOwn(true)}>
          <Archive size={16} />
          {t.residents.archive}
        </button>
      ) : null}
      <Modal open={open} onClose={close} title={t.residents.archiveTitle.replace('{name}', name)}>
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
            <button type="button" className="ui-btn ui-btn--ghost" onClick={close}>
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

type Values = Record<string, string | boolean | null>;

/** The whole record as a form, generated from the template definition: every column the government file has. */
function RecordForm({ kind, id, initial, onClose }: { kind: RecordKind; id: string | null; initial: Values; onClose: () => void }) {
  const { t, locale } = useI18n();
  const def = TEMPLATES[kind];
  const derived = new Set([...Object.values(def.companions), ...def.fields.flatMap((x) => (x.hijriField ? [x.hijriField] : []))]);
  const [, action] = useFeedbackAction(saveRecord.bind(null, kind, id), onClose);
  const val = (k: string) => {
    const v = initial[k];
    return v === null || v === undefined || typeof v === 'boolean' ? '' : v;
  };
  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t.records.manualHint}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {def.fields
          .filter((fd) => !derived.has(fd.field))
          .map((fd) => {
            const label = locale === 'ar' ? fd.labelAr : fd.labelEn;
            const fid = `rec-${kind}-${fd.field}`;
            const isKey = fd.field === def.keyField;
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
                    autoFocus={isKey && !id}
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
      <div className="ui-modal__foot" style={{ margin: '0 -20px -20px' }}>
        <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose}>
          {t.common.cancel}
        </button>
        <SubmitButton>{id ? t.common.save : t.records.add}</SubmitButton>
      </div>
    </form>
  );
}

export function AddRecordButton({ kind, canEdit }: { kind: RecordKind; canEdit: boolean }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  if (!canEdit) return null;
  const def = TEMPLATES[kind];
  return (
    <>
      <button type="button" className="ui-btn ui-btn--outline" onClick={() => setOpen(true)}>
        <Plus size={18} />
        {t.records.add}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={f(t.records.addTitle, { template: locale === 'ar' ? def.nameAr : def.nameEn })} wide>
        {open ? <RecordForm kind={kind} id={null} initial={{}} onClose={() => setOpen(false)} /> : null}
      </Modal>
    </>
  );
}

function EditAllDialog({ kind, id, name, onClose }: { kind: RecordKind; id: string; name: string; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [values, setValues] = useState<Values | null>(null);
  useEffect(() => {
    let live = true;
    loadRecord(kind, id).then((r) => {
      if (!live) return;
      if (r.ok && r.data) setValues(r.data);
      else {
        toast(r.ok ? t.common.error : r.error, 'err');
        onClose();
      }
    });
    return () => {
      live = false;
    };
  }, [kind, id, onClose, t, toast]);
  return (
    <Modal open onClose={onClose} title={f(t.records.editTitle, { name })} wide>
      {values ? <RecordForm kind={kind} id={id} initial={values} onClose={onClose} /> : <div className="ui-empty"><span className="ui-spinner" />{t.records.loading}</div>}
    </Modal>
  );
}

function DeleteDialog({ kind, id, name, onClose }: { kind: RecordKind; id: string; name: string; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Modal open onClose={onClose} title={f(t.records.deleteTitle, { name })}>
      <Notice tone="red">{t.records.deleteBody}</Notice>
      <div className="flex justify-end gap-2">
        <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose}>
          {t.common.cancel}
        </button>
        <button
          type="button"
          className="ui-btn ui-btn--danger"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await deleteRecord(kind, id);
              toast(r.ok ? (r.message ?? t.common.saved) : r.error, r.ok ? 'ok' : 'err');
              if (r.ok) onClose();
            })
          }
        >
          <Trash2 size={16} />
          {t.records.delete}
        </button>
      </div>
    </Modal>
  );
}

/** "⋯" menu on each row: edit every field, archive with a reason, or delete for good. */
export function RowActions({ kind, id, name, canEdit, archived }: { kind: RecordKind; id: string; name: string; canEdit: boolean; archived?: boolean }) {
  const { t } = useI18n();
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<null | 'edit' | 'archive' | 'delete'>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);
  if (!canEdit) return null;
  const pick = (d: 'edit' | 'archive' | 'delete') => {
    setMenu(false);
    setDialog(d);
  };
  return (
    <div ref={ref} className="relative">
      <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon" aria-label={t.records.more} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
        <MoreHorizontal size={18} />
      </button>
      {menu ? (
        <div className="ui-menu" role="menu" style={{ minWidth: 200 }}>
          <button type="button" role="menuitem" onClick={() => pick('edit')}>
            <Pencil size={16} />
            {t.records.editAll}
          </button>
          {archived ? null : (
            <button type="button" role="menuitem" onClick={() => pick('archive')}>
              <Archive size={16} />
              {t.records.archive}
            </button>
          )}
          <hr />
          <button type="button" role="menuitem" className="is-danger" onClick={() => pick('delete')}>
            <Trash2 size={16} />
            {t.records.delete}
          </button>
        </div>
      ) : null}
      {dialog === 'edit' ? <EditAllDialog kind={kind} id={id} name={name} onClose={() => setDialog(null)} /> : null}
      {dialog === 'archive' ? <ArchiveButton kind={kind} id={id} name={name} canEdit open onClose={() => setDialog(null)} /> : null}
      {dialog === 'delete' ? <DeleteDialog kind={kind} id={id} name={name} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
