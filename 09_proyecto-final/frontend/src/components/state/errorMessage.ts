import { useTranslations } from 'next-intl';
import { errorCode } from '@/lib/api/client';

export function useErrorMessage(): (error: unknown) => string {
  const t = useTranslations('errors');
  return (error) => {
    const code = errorCode(error);
    return t.has(code) ? t(code) : t('UNKNOWN');
  };
}
