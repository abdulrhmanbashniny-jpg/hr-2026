'use client';

import { Send } from 'lucide-react';
import { useState, useTransition } from 'react';
import { savePlatformTelegramAlerts, testPlatformTelegramAlerts } from '@/app/admin/actions';
import { Card, Notice } from '@/components/ui/card';
import { Field, SubmitButton, useFeedbackAction } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/lib/i18n/client';
import { f } from '@/lib/i18n/format';

export interface PlatformTelegramVM {
  enabled: boolean;
  hasToken: boolean;
  username: string | null;
  chatIds: string[];
  /** The shared platform bot from the environment can be used without a token here. */
  platformBot: boolean;
}

/** Where the platform team gets alerts such as new "Contact us" messages. */
export function PlatformTelegramCard({ vm }: { vm: PlatformTelegramVM }) {
  const { t } = useI18n();
  const c = t.console.system;
  const toast = useToast();
  const [, save] = useFeedbackAction(savePlatformTelegramAlerts);
  const [testing, startTest] = useTransition();
  // Controlled so the IDs survive the form reset React does after an action that failed.
  const [chats, setChats] = useState(vm.chatIds.join(', '));
  const [enabled, setEnabled] = useState(vm.enabled || !vm.hasToken);
  const on = vm.enabled && vm.chatIds.length > 0 && (vm.hasToken || vm.platformBot);
  return (
    <Card title={c.tgAlertsTitle} sub={c.tgAlertsSub} action={<Send size={18} className="text-muted" />}>
      <div className="flex flex-col gap-4">
        {on ? <Notice tone="green">{f(c.tgAlertsOn, { username: vm.username ?? '—', n: vm.chatIds.length })}</Notice> : <Notice tone="amber">{c.tgAlertsOff}</Notice>}
        <form action={save} className="flex flex-col gap-3.5">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="tgEnabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="ui-check" />
            {c.tgAlertsEnabled}
          </label>
          <Field label={c.tgAlertsToken} htmlFor="pt-token" hint={c.tgAlertsTokenHint}>
            <input id="pt-token" name="tgToken" type="password" autoComplete="off" className="ui-input ui-input--ltr" placeholder={vm.hasToken ? '••••••••' : '123456789:AA…'} />
          </Field>
          <Field label={c.tgAlertsChats} htmlFor="pt-chats" hint={c.tgAlertsChatsHint}>
            <input id="pt-chats" name="tgChats" value={chats} onChange={(e) => setChats(e.target.value)} inputMode="numeric" className="ui-input ui-input--ltr ui-num" placeholder="123456789" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <SubmitButton>{t.common.save}</SubmitButton>
            <button
              type="button"
              className="ui-btn ui-btn--outline"
              disabled={testing || !on}
              onClick={() =>
                startTest(async () => {
                  const r = await testPlatformTelegramAlerts();
                  toast(r.ok ? (r.message ?? '✓') : r.error, r.ok ? 'ok' : 'err');
                })
              }
            >
              <Send size={17} />
              {c.tgAlertsTest}
            </button>
          </div>
        </form>
      </div>
    </Card>
  );
}
