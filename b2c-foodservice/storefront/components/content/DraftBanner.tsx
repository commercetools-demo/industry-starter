import { useTranslations } from 'next-intl';

/** Marks placeholder legal or factual text until the owner signs it off (SO-01). */
export default function DraftBanner() {
  const t = useTranslations('content');
  return (
    <p role="note" className="mb-6 rounded-card border border-amber bg-canvas-2 px-4 py-3 text-[14px] font-medium text-ink">
      {t('draftBanner')}
    </p>
  );
}
