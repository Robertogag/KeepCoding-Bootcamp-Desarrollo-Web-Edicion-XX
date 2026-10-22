import { useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { logout } from '@/lib/auth/bootstrap';

export function useLogout() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      await logout();
      router.replace('/');
    });
  }

  return { logout: run, pending };
}
