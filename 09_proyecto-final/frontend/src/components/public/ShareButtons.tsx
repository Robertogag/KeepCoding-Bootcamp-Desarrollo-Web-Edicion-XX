import { useTranslations } from 'next-intl';
import { buttonClasses } from '@/components/ui/Button';
import { shareLinks, type ShareNetwork } from '@/lib/share';

const NETWORKS: Array<{ key: ShareNetwork; label: string }> = [
  { key: 'x', label: 'X' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'whatsapp', label: 'WhatsApp' },
];

export function ShareButtons({ url, text }: { url: string; text: string }) {
  const t = useTranslations('machine');
  const links = shareLinks(url, text);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="eyebrow">{t('share')}</span>
      {NETWORKS.map((network) => (
        <a
          key={network.key}
          href={links[network.key]}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses('secondary', 'sm')}
        >
          {network.label}
        </a>
      ))}
    </div>
  );
}
