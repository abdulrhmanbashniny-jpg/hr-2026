'use client';

import { Archive, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState, useTransition, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { archiveRecord, deleteRecord, restoreRecord, updateRecord, type RecordKind } from '@/app/app/records-actions';
import { Notice } from '@/components/ui/card';
import { f } from '@/lib/i18n/format';
import { DateInput } from '@/components/ui/date-input';
import { Field, SubmitButton, useFeedbackAction } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/lib/i18n/client';
import { recordEditPath, recordNewPath } from '@/lib/records/meta';

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
      <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" title={title} aria-label={title} onClick={() => setOpen(true)}>
        <RefreshCw size={16} />
        <span className="rec-update__label">{t.common.update}</span>
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

export function AddRecordButton({ kind, canEdit }: { kind: RecordKind; canEdit: boolean }) {
  const { t } = useI18n();
  if (!canEdit) return null;
  return (
    <Link href={recordNewPath(kind)} className="ui-btn ui-btn--outline">
      <Plus size={18} />
      {t.records.add}
    </Link>
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
  const [menu, setMenu] = useState<CSSProperties | null>(null);
  const [dialog, setDialog] = useState<null | 'archive' | 'delete'>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  // The menu is drawn over the page next to its button, so the table's scroll area never clips it;
  // near the bottom of the screen it opens upwards, and it follows the button when the page scrolls.
  const place = (): CSSProperties | null => {
    if (!btn.current) return null;
    const r = btn.current.getBoundingClientRect();
    const style: CSSProperties = { position: 'fixed', minWidth: 200, zIndex: 80 };
    if (window.innerHeight - r.bottom < 200) Object.assign(style, { top: 'auto', bottom: window.innerHeight - r.top + 6 });
    else style.top = r.bottom + 6;
    if (getComputedStyle(btn.current).direction === 'rtl') style.left = r.left;
    else style.right = window.innerWidth - r.right;
    return style;
  };
  const open = !!menu;
  useEffect(() => {
    if (!open) return;
    const inside = (n: EventTarget | null) => ref.current?.contains(n as Node) || list.current?.contains(n as Node);
    const onDoc = (e: MouseEvent) => !inside(e.target) && setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null);
    const follow = () => setMenu(place());
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    };
    // place() reads only refs and the window
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!canEdit) return null;
  const toggle = () => setMenu(menu ? null : place());
  const pick = (d: 'archive' | 'delete') => {
    setMenu(null);
    setDialog(d);
  };
  return (
    <div ref={ref} className="relative">
      <button ref={btn} type="button" className="ui-btn ui-btn--ghost ui-btn--icon" aria-label={t.records.more} aria-haspopup="menu" aria-expanded={!!menu} onClick={toggle}>
        <MoreHorizontal size={18} />
      </button>
      {menu ? createPortal(
        <div ref={list} className="ui-menu" role="menu" style={menu}>
          <Link href={recordEditPath(kind, id)} role="menuitem" onClick={() => setMenu(null)}>
            <Pencil size={16} />
            {t.records.editAll}
          </Link>
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
        </div>,
        document.body,
      ) : null}
      {dialog === 'archive' ? <ArchiveButton kind={kind} id={id} name={name} canEdit open onClose={() => setDialog(null)} /> : null}
      {dialog === 'delete' ? <DeleteDialog kind={kind} id={id} name={name} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
