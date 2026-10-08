import { useTranslations } from 'next-intl';
import type { LabListItem } from '@/lib/account-types';
import { LabRows } from './LabRows';

/** `/account/labs`: every test with name, "<date> · <laboratory>", status badge and an arrow. `labs: null` means the lab source failed. */
export function LabList({ labs }: { labs: LabListItem[] | null }) {
  const t = useTranslations('account.labs');
  return (
    <section aria-labelledby="lab-tests" className="rounded-lg bg-surface shadow-sm">
      <div className="px-5 pt-5 pb-2">
        <h1 id="lab-tests" className="font-display text-2xl font-semibold text-navy-900">
          {t('title')}
        </h1>
        <p className="text-text-muted">{t('sub')}</p>
      </div>
      {labs === null ? (
        <p className="px-5 pb-5 text-danger-700" role="status">
          {t('loadFailed')}
        </p>
      ) : labs.length === 0 ? (
        <p className="px-5 pb-5 text-text-muted">{t('empty')}</p>
      ) : (
        <LabRows labs={labs} showLaboratory />
      )}
    </section>
  );
}
