'use client';

import { useEffect } from 'react';
import { bootstrapSession } from '@/lib/auth/bootstrap';

export function SessionBootstrap() {
  useEffect(() => {
    void bootstrapSession();
  }, []);
  return null;
}
