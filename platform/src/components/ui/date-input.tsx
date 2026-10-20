'use client';

import { useMemo, useState } from 'react';
import { gregorianToHijriString, hijriStringToGregorian } from '@/lib/dates/hijri';
import { useI18n } from '@/lib/i18n/client';
import { f } from '@/lib/i18n/format';

/**
 * A date that can be typed in Gregorian or Hijri (Umm al-Qura). The form receives the typed value in
 * `name` and the calendar in `calendar`; the server converts. The hint shows the other calendar live.
 */
export function DateInput({ name, id, defaultValue, required }: { name: string; id?: string; defaultValue?: string | null; required?: boolean }) {
  const { t } = useI18n();
  const [calendar, setCalendar] = useState<'gregorian' | 'hijri'>('gregorian');
  const [value, setValue] = useState(defaultValue ?? '');
  const hint = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    try {
      if (calendar === 'gregorian') return f(t.common.hijriEquivalent, { date: gregorianToHijriString(value) });
      const g = hijriStringToGregorian(value);
      return g ? f(t.common.gregorianEquivalent, { date: g }) : null;
    } catch {
      return null;
    }
  }, [value, calendar, t]);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          id={id}
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={calendar === 'hijri' ? '1448-08-01' : '2027-01-09'}
          pattern="\d{4}-\d{1,2}-\d{1,2}"
          required={required}
          className="ui-input ui-input--ltr ui-num"
          inputMode="numeric"
        />
        <select
          aria-label={t.documents.calendar}
          className="ui-select"
          style={{ width: 120 }}
          value={calendar}
          onChange={(e) => {
            const next = e.target.value as 'gregorian' | 'hijri';
            if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
              try {
                const converted = next === 'hijri' ? gregorianToHijriString(value) : hijriStringToGregorian(value);
                if (converted) setValue(converted);
              } catch {
                /* keep the typed value */
              }
            }
            setCalendar(next);
          }}
        >
          <option value="gregorian">{t.common.gregorian}</option>
          <option value="hijri">{t.common.hijri}</option>
        </select>
      </div>
      <input type="hidden" name={`${name}__calendar`} value={calendar} />
      {hint ? <span className="ui-hint ui-num">{hint}</span> : null}
    </div>
  );
}
