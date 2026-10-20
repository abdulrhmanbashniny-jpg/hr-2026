'use client';

import { CheckCircle2, Send } from 'lucide-react';
import { useActionState, useState } from 'react';
import { submitContact } from '@/app/actions/contact';
import { Notice } from '@/components/ui/card';
import { Field, SubmitButton } from '@/components/ui/form';
import { CONTACT_CATEGORIES, type ContactCategory } from '@/lib/contact-categories';
import { useI18n } from '@/lib/i18n/client';

export function ContactForm({ defaults }: { defaults: { name: string; phone: string } }) {
  const { t } = useI18n();
  const c = t.contact;
  const [round, setRound] = useState(0);
  const [sentRound, setSentRound] = useState<number | null>(null);
  const [category, setCategory] = useState<ContactCategory>('problem');
  // Controlled, so a server-side error keeps what was typed (React resets uncontrolled fields after an action).
  const [fields, setFields] = useState({ name: defaults.name, phone: defaults.phone, message: '' });
  const bind = (k: keyof typeof fields) => ({ value: fields[k], onChange: (e: { target: { value: string } }) => setFields((x) => ({ ...x, [k]: e.target.value })) });
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof submitContact>> | null, form: FormData) => {
    const r = await submitContact(prev, form);
    if (r.ok) setSentRound(Number(form.get('round')));
    return r;
  }, null);

  if (sentRound === round) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
        <CheckCircle2 size={44} style={{ color: 'var(--green)' }} />
        <h2 className="text-xl font-bold">{c.sentTitle}</h2>
        <p className="text-muted">{c.sent}</p>
        <button
          type="button"
          className="ui-btn ui-btn--outline"
          onClick={() => {
            setFields((x) => ({ ...x, message: '' }));
            setRound((r) => r + 1);
          }}
        >
          {c.another}
        </button>
      </div>
    );
  }

  return (
    <form action={action} key={round} className="flex flex-col gap-4">
      <input type="hidden" name="round" value={round} />
      {state && !state.ok ? (
        <div role="alert">
          <Notice tone="red">{state.error}</Notice>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={c.name} htmlFor="ct-name" required>
          <input id="ct-name" name="name" required minLength={2} maxLength={80} {...bind('name')} autoComplete="name" className="ui-input" />
        </Field>
        <Field label={c.phone} htmlFor="ct-phone" required>
          <input id="ct-phone" name="phone" type="tel" required inputMode="tel" {...bind('phone')} autoComplete="tel" placeholder="05xxxxxxxx" className="ui-input ui-input--ltr" />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="ui-label mb-1">{c.category}</legend>
        <div className="ui-seg self-start">
          {CONTACT_CATEGORIES.map((k) => (
            <label key={k} className="ui-seg__link ui-seg__choice" data-checked={category === k}>
              <input type="radio" name="category" value={k} checked={category === k} onChange={() => setCategory(k)} className="sr-only" />
              {c.categories[k]}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={c.message} htmlFor="ct-message" required>
        <textarea id="ct-message" name="message" required minLength={10} maxLength={4000} {...bind('message')} placeholder={c.messagePlaceholder} className="ui-textarea" style={{ minHeight: 140 }} />
      </Field>
      {/* Honeypot: hidden from people, filled by bots. */}
      <div aria-hidden="true" style={{ position: 'absolute', insetInlineStart: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <SubmitButton>
        <Send size={17} />
        {c.send}
      </SubmitButton>
    </form>
  );
}
