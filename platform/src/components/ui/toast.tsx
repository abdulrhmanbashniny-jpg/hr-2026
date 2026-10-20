'use client';

import { CircleCheck, CircleX, Info } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Tone = 'ok' | 'err' | 'info';
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((message: string, tone: Tone = 'info') => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, message, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tone === 'err' ? 7000 : 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed bottom-5 z-[100] flex flex-col gap-2" style={{ insetInlineStart: 20 }}>
        {items.map((t) => (
          <div key={t.id} className={`ui-toast ${t.tone === 'ok' ? 'ui-toast--ok' : t.tone === 'err' ? 'ui-toast--err' : ''}`}>
            {t.tone === 'ok' ? <CircleCheck size={18} /> : t.tone === 'err' ? <CircleX size={18} /> : <Info size={18} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
