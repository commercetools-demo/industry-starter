import { useTranslations } from 'next-intl';

/** Slim band above the header; the text comes from `common.announcement`. */
export function AnnouncementBar() {
  const t = useTranslations('common');
  return (
    <div className="bg-accent-2-800 py-(--space-2) text-center text-[13px] text-accent-2-100">
      <p className="m-0">{t('announcement')}</p>
    </div>
  );
}
