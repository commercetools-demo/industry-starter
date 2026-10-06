'use client';

import { useTranslations } from 'next-intl';
import { HeartButton } from '@/components/ui/HeartButton';
import { useSaved } from '@/hooks/useSaved';

/**
 * Heart on a tile. It sits next to (not inside) the tile link; the click handlers still stop the event so a
 * wrapping link could never navigate. The saved state is resolved on the client and never cached with the tile HTML.
 */
export function SaveButton({ productId, name, className }: { productId: string; name: string; className?: string }) {
  const t = useTranslations('plp');
  const { isSaved, toggle } = useSaved();
  const pressed = isSaved(productId);
  return (
    <span
      className={className}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <HeartButton pressed={pressed} label={pressed ? t('unsave', { name }) : t('save', { name })} onToggle={() => void toggle(productId)} className="shadow-sm" />
    </span>
  );
}
