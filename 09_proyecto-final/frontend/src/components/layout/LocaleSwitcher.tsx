'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';

const selectClasses =
  'h-9 rounded-md border border-line bg-panel px-2 text-sm text-fg hover:bg-panel-2 disabled:opacity-60';

function LocaleSelect() {
  const locale = useLocale();
  const t = useTranslations('locale');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function change(next: AppLocale) {
    startTransition(() => {
      const search = searchParams.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { locale: next });
    });
  }

  return (
    <label className="inline-flex items-center">
      <span className="sr-only">{t('label')}</span>
      <select
        className={selectClasses}
        value={locale}
        disabled={pending}
        onChange={(event) => change(event.target.value as AppLocale)}
      >
        {routing.locales.map((item) => (
          <option key={item} value={item}>
            {t(item)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function LocaleSwitcher() {
  return (
    <Suspense fallback={<select className={selectClasses} disabled aria-hidden="true" />}>
      <LocaleSelect />
    </Suspense>
  );
}
