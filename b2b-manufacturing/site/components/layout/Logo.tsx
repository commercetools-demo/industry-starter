import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export function Logo({ subline = true }: { subline?: boolean }) {
  const t = useTranslations('chrome');
  return (
    <Link className="logo" href="/">
      <i aria-hidden="true" />Malva {subline ? <small>{t('logoSubline')}</small> : null}
    </Link>
  );
}
