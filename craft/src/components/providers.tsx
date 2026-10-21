'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/toast';
import { ServiceWorker } from '@/components/sw-register';

export function Providers({ children }: { children: ReactNode; nonce?: string }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
        <ToastProvider>
          {children}
          <ServiceWorker />
        </ToastProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
