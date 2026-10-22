import { useTranslations } from 'next-intl';
import { MachineImage } from '@/components/plants/MachineImage';
import type { MachineState, Photo } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { mediaUrl } from '@/lib/env';

interface ResponsivePhotoProps {
  photo: Photo | null;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
  state?: MachineState;
}

// Foto de la máquina en tres tamaños; sin foto, la silueta teñida con el estado actual.
export function ResponsivePhoto({
  photo,
  alt,
  sizes = '(min-width: 1024px) 480px, 100vw',
  className,
  priority = false,
  state = 'OFFLINE',
}: ResponsivePhotoProps) {
  const t = useTranslations('machine');
  if (!photo) {
    return (
      <div
        role="img"
        aria-label={t('noPhoto')}
        className={cn(
          'panel flex aspect-[3/2] w-full items-center justify-center overflow-hidden p-8',
          className,
        )}
      >
        <MachineImage state={state} className="w-full max-w-[26rem]" />
      </div>
    );
  }
  return (
    <img
      src={mediaUrl(photo.md)}
      srcSet={`${mediaUrl(photo.sm)} 320w, ${mediaUrl(photo.md)} 768w, ${mediaUrl(photo.lg)} 1280w`}
      sizes={sizes}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={cn('aspect-[3/2] w-full rounded-lg border border-line object-cover', className)}
    />
  );
}
