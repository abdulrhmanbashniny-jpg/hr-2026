'use client';

import { useRouter } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/lib/i18n/client';
import type { ActionResult } from '@/app/admin/actions';

/** A button bound to a server action, with confirmation, pending state and a toast. */
export function ActionButton({
  action,
  children,
  variant = 'secondary',
  size = 'sm',
  confirm: confirmText,
  icon,
}: {
  action: () => Promise<ActionResult>;
  children: ReactNode;
  variant?: 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  confirm?: string;
  icon?: ReactNode;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      size={size}
      icon={icon}
      loading={pending}
      onClick={() => {
        if (confirmText && !confirm(confirmText)) return;
        start(async () => {
          const r = await action();
          if (r.ok) {
            toast(t.common.saved);
            router.refresh();
          } else toast(r.error, 'error');
        });
      }}
    >
      {children}
    </Button>
  );
}
