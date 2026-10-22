import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OeeTrendChart } from '@/components/charts/OeeTrendChart';
import { Counter } from '@/components/oee/Counter';
import { OeeMetricsRow } from '@/components/oee/OeeMetricsRow';
import { ResponsivePhoto } from '@/components/public/ResponsivePhoto';
import { ShareButtons } from '@/components/public/ShareButtons';
import { SinceLabel } from '@/components/status/SinceLabel';
import { StateIndicator } from '@/components/status/StateIndicator';
import { IconChevronLeft } from '@/components/ui/icons';
import { Link } from '@/i18n/navigation';
import { isApiError } from '@/lib/api/client';
import { loadPublicMachine } from '@/lib/api/public';
import type { PublicMachineDetail } from '@/lib/api/types';
import { mediaUrl } from '@/lib/env';
import { EMPTY_VALUE, formatDecimal, formatInteger, formatPercent } from '@/lib/format';
import { stateStyles } from '@/lib/machine-state';
import { absoluteUrl, localizedPath, pageMetadata } from '@/lib/seo';

interface MachinePageProps {
  params: Promise<{ locale: string; plantSlug: string; machineSlug: string }>;
}

async function loadOrNotFound(
  plantSlug: string,
  machineSlug: string,
): Promise<PublicMachineDetail> {
  try {
    return await loadPublicMachine(plantSlug, machineSlug);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: MachinePageProps): Promise<Metadata> {
  const { locale, plantSlug, machineSlug } = await params;
  const machine = await loadOrNotFound(plantSlug, machineSlug);
  const t = await getTranslations({ locale, namespace: 'machine' });
  return pageMetadata({
    locale,
    path: `/plants/${machine.plant.slug}/${machine.slug}`,
    title: t('metaTitle', { machine: machine.name, plant: machine.plant.name }),
    description: t('metaDescription', { machine: machine.name, plant: machine.plant.name }),
    image: machine.photo ? mediaUrl(machine.photo.lg) : undefined,
  });
}

export default async function PublicMachinePage({ params }: MachinePageProps) {
  const { locale, plantSlug, machineSlug } = await params;
  setRequestLocale(locale);
  const machine = await loadOrNotFound(plantSlug, machineSlug);
  const t = await getTranslations('machine');
  const tm = await getTranslations('machines');
  const tp = await getTranslations('publicPlant');
  const { snapshot, plant } = machine;
  const model = [machine.brand, machine.model].filter(Boolean).join(' ');
  const pageUrl = absoluteUrl(localizedPath(locale, `/plants/${plant.slug}/${machine.slug}`));

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <nav aria-label={tp('backToPlant', { name: plant.name })}>
        <Link
          href={`/plants/${plant.slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
        >
          <IconChevronLeft className="size-4" />
          {tp('backToPlant', { name: plant.name })}
        </Link>
      </nav>

      <header className="panel p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow">{tm('machineLabel')}</p>
            <h1 className="text-3xl font-semibold tracking-tight">{machine.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {model || EMPTY_VALUE} · {plant.name}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3">
          <StateIndicator
            state={snapshot.state}
            size="lg"
            variant="label"
            className={stateStyles[snapshot.state].text}
          />
          <span className="text-sm text-muted">
            {t('since')} <SinceLabel since={snapshot.since} className="numeric text-fg" />
          </span>
          {snapshot.state === 'DOWN' && snapshot.alarm_code > 0 ? (
            <span className="text-sm font-medium text-down">
              {t('alarm', { code: snapshot.alarm_code })}
            </span>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <ResponsivePhoto photo={machine.photo} state={snapshot.state} alt={machine.name} priority />
        <div className="space-y-4">
          <section aria-labelledby="oee-today" className="panel p-4">
            <h2 id="oee-today" className="eyebrow">
              {t('oeeToday')}
            </h2>
            <OeeMetricsRow metrics={snapshot.oee_today} size="lg" className="mt-3" />
          </section>
          <section aria-labelledby="counters" className="panel p-4">
            <h2 id="counters" className="eyebrow">
              {t('counters')}
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Counter label={t('good')} value={formatInteger(snapshot.good, locale)} />
              <Counter label={t('reject')} value={formatInteger(snapshot.reject, locale)} />
              <Counter
                label={t('lastCycle')}
                value={
                  snapshot.last_cycle_s === null
                    ? EMPTY_VALUE
                    : formatDecimal(snapshot.last_cycle_s, locale)
                }
                unit={snapshot.last_cycle_s === null ? undefined : 's'}
              />
              <Counter
                label={t('idealCycle')}
                value={formatDecimal(machine.ideal_cycle_s, locale)}
                unit="s"
              />
            </dl>
            <p className="mt-3 text-xs text-muted">{t('countersHint')}</p>
          </section>
        </div>
      </div>

      <OeeTrendChart
        rows={machine.trend}
        timeZone={plant.timezone}
        granularity="hour"
        title={t('trend12h')}
      />

      <ShareButtons
        url={pageUrl}
        text={t('shareText', {
          machine: machine.name,
          plant: plant.name,
          oee: formatPercent(snapshot.oee_today.oee, locale),
        })}
      />
    </div>
  );
}
