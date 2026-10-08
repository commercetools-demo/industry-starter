import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

// Shown for an unknown or foreign lab id (and any other `notFound()` below /account), inside the account shell, with
// HTTP 404. One body for both cases.
export default function AccountNotFound() {
  const t = useTranslations('account.labs');
  return (
    <div className="grid gap-3" data-error-kind="not-found">
      <p className="font-display text-xl font-semibold text-navy-900">{t('notFound')}</p>
      <Link href="/account/labs" className="text-text-link">
        {t('back')}
      </Link>
    </div>
  );
}
