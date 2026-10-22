'use client';

import { FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { useState } from 'react';
import { buttonClass } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { useConsole } from './console-i18n';

const TYPES = ['invoices', 'ledger', 'redemptions', 'craftsmen'] as const;

export function ExportPanel() {
  const c = useConsole();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const q = (type: string, format: string) => `/api/v1/admin/export?type=${type}&format=${format}&from=${from}&to=${to}`;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={c.reports.from}>
          <Input type="date" className="num" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={c.reports.to}>
          <Input type="date" className="num" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <button onClick={() => window.print()} className={buttonClass('secondary', 'md', 'print:hidden')}>
          <Printer className="size-4" />
          {c.reports.print}
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {TYPES.map((t) => (
          <div key={t} className="surface flex flex-col gap-3 p-5">
            <h3 className="font-semibold">{c.reports.types[t]}</h3>
            <p className="flex-1 text-sm text-muted">{c.reports.descriptions[t]}</p>
            <div className="flex gap-2 print:hidden">
              <a href={q(t, 'xlsx')} className={buttonClass('primary', 'sm')}>
                <FileSpreadsheet className="size-4" />
                Excel
              </a>
              <a href={q(t, 'csv')} className={buttonClass('secondary', 'sm')}>
                <FileText className="size-4" />
                CSV
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
