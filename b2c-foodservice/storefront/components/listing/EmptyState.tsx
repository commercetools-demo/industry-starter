import { useTranslations } from 'next-intl';
import ButtonLink from '@/components/ui/ButtonLink';
import Icon from '@/components/ui/Icon';

/** Filters matched nothing: centred search icon, message and a "Clear all filters" button. The chips stay above. */
export default function EmptyState({ clearAllHref }: { clearAllHref: string }) {
  const t = useTranslations('plp.empty');
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center" data-testid="empty-state">
      <Icon name="search" size={40} className="text-ink-3" />
      <p className="m-0 font-display text-[18px] font-semibold text-ink">{t('title')}</p>
      <ButtonLink href={clearAllHref} variant="ghost" scroll={false}>
        {t('clear')}
      </ButtonLink>
    </div>
  );
}
