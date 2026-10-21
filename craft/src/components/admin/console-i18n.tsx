'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ConsoleDictionary } from '@/lib/i18n/console-ar';

const Ctx = createContext<ConsoleDictionary | null>(null);

export function ConsoleI18nProvider({ c, children }: { c: ConsoleDictionary; children: ReactNode }) {
  return <Ctx.Provider value={c}>{children}</Ctx.Provider>;
}

export function useConsole(): ConsoleDictionary {
  const c = useContext(Ctx);
  if (!c) throw new Error('useConsole must be used inside ConsoleI18nProvider');
  return c;
}
