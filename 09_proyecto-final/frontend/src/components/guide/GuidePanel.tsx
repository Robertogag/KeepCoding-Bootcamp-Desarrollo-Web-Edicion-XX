import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';

const STEPS = ['board', 'machine', 'stops', 'data'] as const;

// Guía de uso en cuatro pasos: la misma en la portada y en Mis plantas.
export function GuidePanel({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslations('guide');
  return (
    <section aria-labelledby="guide-title" className={cn('panel p-5', className)}>
      <h2 id="guide-title" className="eyebrow text-accent-text">
        {t('title')}
      </h2>
      <p className="mt-1 text-sm text-muted">{t('intro')}</p>
      <ol className={cn('mt-4 grid gap-3', compact ? 'sm:grid-cols-2' : 'md:grid-cols-4')}>
        {STEPS.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="numeric flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-accent-fg">
              {index + 1}
            </span>
            <div>
              <p className="font-bold">{t(`steps.${step}.title`)}</p>
              <p className="mt-0.5 text-sm text-muted">{t(`steps.${step}.text`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
