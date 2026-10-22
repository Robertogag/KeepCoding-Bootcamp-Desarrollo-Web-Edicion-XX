import type { ReactNode } from 'react';
import { AppGate } from '@/components/auth/AppGate';
import { AppShell } from '@/components/layout/AppShell';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppGate>
      <AppShell>{children}</AppShell>
    </AppGate>
  );
}
