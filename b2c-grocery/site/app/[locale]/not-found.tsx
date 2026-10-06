import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

export default function LocaleNotFound() {
  const t = useTranslations('errors');
  return (
    <div className="mx-auto max-w-[640px] px-(--space-4) py-(--space-8) text-center">
      <h6 className="text-accent-700">{t('notFoundKicker')}</h6>
      <h1>{t('notFoundTitle')}</h1>
      <p>{t('notFoundBody')}</p>
      <div className="flex flex-wrap justify-center gap-(--space-3)">
        <Button href="/shop">{t('backToShop')}</Button>
        <Button href="/contact" variant="secondary">
          {t('contact')}
        </Button>
      </div>
    </div>
  );
}
