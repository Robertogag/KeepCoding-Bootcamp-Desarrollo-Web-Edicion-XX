'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { iconButtonClasses } from '@/components/ui/Button';
import { IconMoon, IconSun } from '@/components/ui/icons';

const subscribeNoop = () => () => {};

export function ThemeToggle() {
  const t = useTranslations('theme');
  const { resolvedTheme, setTheme } = useTheme();
  // El tema real solo se conoce en el cliente; antes de hidratar se pinta un hueco del mismo tamaño.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const dark = resolvedTheme === 'dark';

  if (!mounted) return <span className={iconButtonClasses} aria-hidden="true" />;

  return (
    <button
      type="button"
      className={iconButtonClasses}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? t('light') : t('dark')}
      title={dark ? t('light') : t('dark')}
    >
      {dark ? <IconSun /> : <IconMoon />}
    </button>
  );
}
