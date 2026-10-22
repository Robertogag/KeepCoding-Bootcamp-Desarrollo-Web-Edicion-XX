'use client';

import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { SessionBootstrap } from '@/components/auth/SessionBootstrap';
import { RealtimeProvider } from '@/components/realtime/RealtimeProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { QueryProvider } from '@/lib/query/provider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryProvider>
        <ToastProvider>
          <SessionBootstrap />
          <RealtimeProvider>{children}</RealtimeProvider>
        </ToastProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
