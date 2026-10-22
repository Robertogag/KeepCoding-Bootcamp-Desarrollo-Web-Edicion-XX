import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LoginForm } from '@/components/auth/LoginForm';
import { Pagination } from '@/components/layout/Pagination';
import { PublicPlantCard } from '@/components/plants/PublicPlantCard';
import { EmptyState } from '@/components/state/EmptyState';
import { ErrorState } from '@/components/state/ErrorState';
import { buttonClasses } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
import { errorCode } from '@/lib/api/client';
import { listPublicPlants } from '@/lib/api/public';
import { pageMetadata } from '@/lib/seo';

interface LandingPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}

const STEPS = ['board', 'machine', 'stops', 'data'] as const;

export async function generateMetadata({ params }: LandingPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'landing' });
  const tm = await getTranslations({ locale, namespace: 'meta' });
  return pageMetadata({ locale, path: '/', title: t('title'), description: tm('description') });
}

function parsePage(value: string | undefined): number {
  const page = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

// Portada: un solo panel de acceso sobre la foto de la nave, con la cuenta de demo al pie;
// la guía de uso va como texto, sin cajas, y el tablero público sigue disponible debajo.
export default async function LandingPage({ params, searchParams }: LandingPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const page = parsePage((await searchParams).page);
  const t = await getTranslations('landing');
  const tg = await getTranslations('guide');
  const tErrors = await getTranslations('errors');
  // Variables de entorno del servidor, no NEXT_PUBLIC_*: Next incrusta esas al compilar.
  const demoUser = process.env.DEMO_USERNAME || 'demo';
  const demoPassword = process.env.DEMO_PASSWORD || '';

  const result = await listPublicPlants(page)
    .then((data) => ({ data, error: null as unknown }))
    .catch((error: unknown) => ({ data: null, error }));
  const firstPublic = result.data?.items[0] ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <section className="grid gap-10 py-10 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-16 lg:py-14">
        <div className="panel p-6 sm:p-7">
          <p className="eyebrow text-accent-text">{t('kicker')}</p>
          <h1 className="mt-2 text-[26px] leading-tight font-extrabold tracking-tight">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
          <div className="mt-6">
            <LoginForm />
          </div>
          <p className="mt-4 text-xs text-muted">
            {t('noAccount')}{' '}
            <Link href="/register" className="font-bold text-fg underline-offset-2 hover:underline">
              {t('cta')}
            </Link>
          </p>
          <div className="mt-6 border-t border-line pt-4">
            <p className="eyebrow">{t('access.title')}</p>
            <p className="mt-1 text-sm text-muted">{t('access.intro')}</p>
            <dl className="numeric mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">{t('access.user')}</dt>
              <dd className="font-extrabold">{demoUser}</dd>
              <dt className="text-muted">{t('access.password')}</dt>
              <dd className={demoPassword ? 'font-extrabold' : 'text-muted'}>
                {demoPassword || t('access.passwordHint')}
              </dd>
            </dl>
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <p className="eyebrow text-accent-text">{tg('title')}</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
            {t('headline')}
          </h2>
          <p className="mt-3 max-w-xl text-base text-muted">{t('access.role')}</p>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="numeric flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-accent-fg">
                  {index + 1}
                </span>
                <div>
                  <p className="font-bold">{tg(`steps.${step}.title`)}</p>
                  <p className="mt-0.5 text-sm text-muted">{tg(`steps.${step}.text`)}</p>
                </div>
              </li>
            ))}
          </ol>
          {firstPublic ? (
            <div className="mt-8">
              <Link
                href={`/plants/${firstPublic.slug}`}
                className={buttonClasses('secondary', 'md')}
              >
                {t('access.publicBoard')}
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="public-plants">
        <h2 id="public-plants" className="text-xl font-extrabold tracking-tight">
          {t('publicPlantsTitle')}
        </h2>
        <p className="mt-1 text-sm text-muted">{t('publicPlantsText')}</p>
        {result.error ? (
          <ErrorState
            className="mt-6"
            message={tErrors(errorCode(result.error))}
            action={
              <Link href="/" className={buttonClasses('secondary', 'sm')}>
                {t('retry')}
              </Link>
            }
          />
        ) : result.data && result.data.items.length === 0 ? (
          <EmptyState
            className="mt-6"
            title={t('noPublicPlantsTitle')}
            text={t('noPublicPlantsText')}
          />
        ) : result.data ? (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.data.items.map((plant) => (
                <PublicPlantCard key={plant.id} plant={plant} />
              ))}
            </div>
            <div className="mt-6">
              <Pagination data={result.data} hrefFor={(p) => (p === 1 ? '/' : `/?page=${p}`)} />
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
