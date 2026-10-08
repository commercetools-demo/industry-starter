import { useTranslations } from 'next-intl';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// Shell of the not-found page; workstream I replaces the copy and adds the specific cases.
export default function LocaleNotFound() {
  const t = useTranslations();
  return (
    <div className="mx-auto max-w-content px-5 py-14 nav:px-8">
      <Card className="mx-auto grid max-w-110 gap-4">
        <p className="text-lg text-navy-900">{t('errors.notFound')}</p>
        <ButtonLink href="/">{t('shell.goHome')}</ButtonLink>
      </Card>
    </div>
  );
}
