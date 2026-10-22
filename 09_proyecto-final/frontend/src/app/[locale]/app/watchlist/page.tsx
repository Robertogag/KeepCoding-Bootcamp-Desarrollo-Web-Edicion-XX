import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { WatchlistPanel } from '@/components/watchlist/WatchlistPanel';

interface WatchlistPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: WatchlistPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'watchlist' });
  return { title: t('title') };
}

export default async function WatchlistPage({ params }: WatchlistPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <WatchlistPanel />;
}
