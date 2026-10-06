import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

/** "Questions? Contact us" strip (D-021: replaces the prototype's stylist note). */
export function ContactStrip() {
  const t = useTranslations('pdp');
  return (
    <div className="flex flex-wrap items-center justify-between gap-(--space-3) rounded-lg bg-accent-2-100 px-(--space-4) py-(--space-3)">
      <span className="text-[15px]">{t('questions')}</span>
      <Button href="/contact" variant="ghost">
        {t('contact')}
      </Button>
    </div>
  );
}
