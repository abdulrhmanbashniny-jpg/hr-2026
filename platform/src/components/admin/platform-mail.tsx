'use client';

import { Mail, Send } from 'lucide-react';
import { savePlatformMail, testPlatformMail } from '@/app/admin/actions';
import { Card, Notice } from '@/components/ui/card';
import { Field, SubmitButton, useFeedbackAction } from '@/components/ui/form';
import { useI18n } from '@/lib/i18n/client';

export interface PlatformMailVM {
  source: 'database' | 'env' | null;
  /** Settings were saved from the console at least once. */
  saved: boolean;
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  hasPassword: boolean;
  fromName: string;
  fromEmail: string;
}

/** The platform's own mail server, edited and tested from the console. */
export function PlatformMailCard({ vm }: { vm: PlatformMailVM }) {
  const { t } = useI18n();
  const c = t.console.system;
  const [, save] = useFeedbackAction(savePlatformMail);
  const [, test] = useFeedbackAction(testPlatformMail);
  return (
    <Card title={c.mailTitle} sub={c.mailSub} action={<Mail size={18} className="text-muted" />}>
      <div className="flex flex-col gap-4">
        {vm.source === 'database' ? <Notice tone="green">{c.mailSourceDb}</Notice> : vm.source === 'env' ? <Notice tone="green">{c.mailSourceEnv}</Notice> : <Notice tone="amber">{c.mailSourceNone}</Notice>}
        <form action={save} className="grid gap-3.5 md:grid-cols-2">
          <label className="flex items-center gap-2 md:col-span-2">
            <input type="checkbox" name="smtpEnabled" defaultChecked={vm.saved ? vm.enabled : vm.source !== 'env'} className="ui-check" />
            {c.mailEnabled}
          </label>
          <Field label={t.settings.smtpHost} htmlFor="pm-host">
            <input id="pm-host" name="smtpHost" defaultValue={vm.host} className="ui-input ui-input--ltr" placeholder="smtp.gmail.com" />
          </Field>
          <Field label={t.settings.smtpPort} htmlFor="pm-port">
            <input id="pm-port" name="smtpPort" type="number" min={1} max={65535} defaultValue={vm.port} className="ui-input ui-input--ltr ui-num" />
          </Field>
          <Field label={t.settings.smtpUser} htmlFor="pm-user">
            <input id="pm-user" name="smtpUser" defaultValue={vm.user} autoComplete="off" className="ui-input ui-input--ltr" placeholder="name@gmail.com" />
          </Field>
          <Field label={t.settings.smtpPassword} htmlFor="pm-pass" hint={vm.hasPassword ? t.settings.smtpPasswordKeep : undefined}>
            <input id="pm-pass" name="smtpPassword" type="password" autoComplete="new-password" className="ui-input ui-input--ltr" />
          </Field>
          <Field label={t.settings.smtpFromName} htmlFor="pm-from-name">
            <input id="pm-from-name" name="smtpFromName" defaultValue={vm.fromName} className="ui-input" placeholder={t.meta.product} />
          </Field>
          <Field label={t.settings.smtpFromEmail} htmlFor="pm-from">
            <input id="pm-from" name="smtpFromEmail" type="email" defaultValue={vm.fromEmail} className="ui-input ui-input--ltr" placeholder="no-reply@example.com" />
          </Field>
          <label className="flex items-center gap-2 md:col-span-2">
            <input type="checkbox" name="smtpSecure" defaultChecked={vm.secure} className="ui-check" />
            {t.settings.smtpSecure}
          </label>
          <p className="ui-hint md:col-span-2">{c.mailGmail}</p>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <SubmitButton>{t.common.save}</SubmitButton>
            <button type="submit" formAction={test} className="ui-btn ui-btn--outline">
              <Send size={17} />
              {c.mailTest}
            </button>
          </div>
        </form>
      </div>
    </Card>
  );
}
