'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import type { Plant } from '@/lib/api/types';
import { cn } from '@/lib/cn';

type MainKey = 'board' | 'machines' | 'production' | 'downtimes' | 'reports';
type ConfigKey = 'catalogs' | 'shifts' | 'members' | 'alerts' | 'settings';

const MAIN: Array<{ key: MainKey; segment: string }> = [
  { key: 'board', segment: '' },
  { key: 'machines', segment: '/machines' },
  { key: 'production', segment: '/production' },
  { key: 'downtimes', segment: '/downtimes' },
  { key: 'reports', segment: '/reports' },
];

// Todo lo que se configura una vez vive aparte: catálogos, turnos, personal, alertas y la planta.
const CONFIG: Array<{ key: ConfigKey; segment: string; ownerOnly?: boolean }> = [
  { key: 'catalogs', segment: '/catalogs' },
  { key: 'shifts', segment: '/shifts' },
  { key: 'members', segment: '/members' },
  { key: 'alerts', segment: '/alerts' },
  { key: 'settings', segment: '/settings', ownerOnly: true },
];

function configHref(plant: Plant): string {
  return `/app/plants/${plant.id}${plant.role === 'owner' ? '/settings' : '/catalogs'}`;
}

export function isConfigPath(pathname: string, plantId: number): boolean {
  const base = `/app/plants/${plantId}`;
  return CONFIG.some((tab) => pathname.startsWith(`${base}${tab.segment}`));
}

function tabClass(active: boolean): string {
  return cn(
    '-mb-px inline-block border-b-2 px-3 py-2.5 text-[12px] font-bold tracking-[0.08em] uppercase transition-colors',
    active
      ? 'border-accent-text text-accent-text'
      : 'border-transparent text-muted hover:border-line-strong hover:text-fg',
  );
}

export function PlantNav({ plant }: { plant: Plant }) {
  const t = useTranslations('plants.nav');
  const pathname = usePathname();
  const base = `/app/plants/${plant.id}`;
  const configActive = isConfigPath(pathname, plant.id);

  return (
    <nav aria-label={t('board')} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1 border-b border-line-strong">
        {MAIN.map((tab) => {
          const href = `${base}${tab.segment}`;
          const active =
            tab.segment === '' ? pathname === base : !configActive && pathname.startsWith(href);
          return (
            <li key={tab.key}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={tabClass(active)}
              >
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
        <li className="ml-auto">
          <Link
            href={configHref(plant)}
            aria-current={configActive ? 'page' : undefined}
            className={tabClass(configActive)}
          >
            {t('config')}
          </Link>
        </li>
      </ul>
    </nav>
  );
}

export function ConfigNav({ plant }: { plant: Plant }) {
  const t = useTranslations('plants.nav');
  const pathname = usePathname();
  const base = `/app/plants/${plant.id}`;
  if (!isConfigPath(pathname, plant.id)) return null;
  return (
    <nav aria-label={t('config')} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1 rounded-md border border-line-strong p-0.5">
        {CONFIG.filter((tab) => !tab.ownerOnly || plant.role === 'owner').map((tab) => {
          const href = `${base}${tab.segment}`;
          const active = pathname.startsWith(href);
          return (
            <li key={tab.key}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-block rounded px-3 py-1.5 text-[12px] font-bold',
                  active ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg',
                )}
              >
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
