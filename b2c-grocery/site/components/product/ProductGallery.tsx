import { useTranslations } from 'next-intl';
import { Photo } from '@/components/ui/Photo';

/** Most photos shown: one primary and two details. */
export const GALLERY_MAX_IMAGES = 3;

/**
 * Two columns, 13 px gap: the primary photo spans both (600 px at `desktop`), two secondary photos (290 px) sit below.
 * Fewer than three images simply omit the missing tiles. The primary image is the LCP element, so it has `priority`.
 */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const t = useTranslations('pdp');
  const [primary, ...rest] = images.slice(0, GALLERY_MAX_IMAGES);
  if (!primary) {
    return <Photo src="" alt={name} sizes="(min-width: 75rem) 600px, 100vw" className="h-[360px] desktop:h-[600px]" />;
  }
  return (
    <div className="grid grid-cols-2 gap-[13px]">
      <Photo src={primary} alt={name} sizes="(min-width: 75rem) 600px, 100vw" priority className="col-span-2 h-[360px] tablet:h-[480px] desktop:h-[600px]" />
      {rest.map((src, index) => (
        <Photo
          key={src}
          src={src}
          alt={t('photoAlt', { name, number: index + 2 })}
          sizes="(min-width: 75rem) 290px, 50vw"
          className="h-[170px] tablet:h-[240px] desktop:h-[290px]"
        />
      ))}
    </div>
  );
}
