'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/lib/i18n/client';

const noop = () => () => {};
const isClient = () => true;
const isServer = () => false;

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  // Rendered into <body>: glass cards use backdrop-filter, which would otherwise trap a fixed
  // overlay inside the card and clip it.
  const mounted = useSyncExternalStore(noop, isClient, isServer);

  useEffect(() => {
    if (!open || !mounted) return;
    opener.current = document.activeElement;
    const first = ref.current?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea, button:not([data-close])');
    first?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open, mounted, onClose]);

  if (!open || !mounted) return null;
  return createPortal(
    <div className="ui-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`ui-modal ${wide ? 'ui-modal--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="ui-modal__head">
          <h2 id={id} className="ui-modal__title">
            {title}
          </h2>
          <button type="button" data-close className="ui-btn ui-btn--ghost ui-btn--icon" aria-label={t.common.close} onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="ui-modal__body">{children}</div>
        {footer ? <div className="ui-modal__foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
