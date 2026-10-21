'use client';

import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import { useSavedItems } from '@/hooks/useSavedItems';
import { cn } from '@/lib/cn';

/** Heart toggle for the saved items. Not nested in the card link, so it never navigates. */
export default function SaveButton({ productId, name, className }: { productId: string; name: string; className?: string }) {
  const t = useTranslations('card');
  const { isSaved, toggle } = useSavedItems();
  const saved = isSaved(productId);
  return (
    <button
      type="button"
      aria-label={t('saveNamed', { name })}
      aria-pressed={saved}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(productId);
      }}
      className={cn(
        'transition-state absolute right-3 top-3 z-20 flex h-[34px] w-[34px] items-center justify-center rounded-pill border-0 bg-surface text-ink shadow-lg/10',
        'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100',
        saved && 'text-accent opacity-100',
        className,
      )}
    >
      <Icon name="heart" size={18} fill={saved ? 'currentColor' : 'none'} />
    </button>
  );
}
