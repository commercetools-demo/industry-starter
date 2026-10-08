import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { CONTROL_CLASSES } from '@/components/ui/Field';
import { MAX_QUERY_LENGTH } from '@/lib/listing-url';

/**
 * Search box that works without JavaScript: a GET form to `/<locale>/search?q=`. The header and the home page
 * can render it as is. The text stays in the box after a search so it can be edited.
 */
export function SearchForm({
  defaultValue = '',
  className,
  required = false,
}: {
  defaultValue?: string;
  className?: string;
  /** Blocks an empty (or blank) submit in the browser, so the visitor stays on the page (home hero). */
  required?: boolean;
}) {
  const t = useTranslations('search');
  const locale = useLocale();
  return (
    <form role="search" method="get" action={`/${locale}/search`} aria-label={t('label')} className={className ?? 'mt-5 flex max-w-xl flex-wrap gap-3'}>
      <input
        type="search"
        name="q"
        aria-label={t('label')}
        placeholder={t('placeholder')}
        defaultValue={defaultValue}
        maxLength={MAX_QUERY_LENGTH}
        required={required || undefined}
        pattern={required ? '.*\\S.*' : undefined}
        className={`${CONTROL_CLASSES} h-11.5 flex-[1_1_16rem]`}
      />
      <Button type="submit">{t('submit')}</Button>
    </form>
  );
}
