import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

/** No product matches: centred copy, "Clear filters" back to the bare listing and a "Contact us" link. */
export function ListingEmpty({ clearHref = '/shop' }: { clearHref?: string }) {
  const t = useTranslations('plp.empty');
  return (
    <section className="mx-auto flex max-w-[460px] flex-col items-center gap-(--space-3) py-(--space-8) text-center">
      <h3 className="m-0 text-[26px]">{t('title')}</h3>
      <p className="m-0 text-muted">{t('body')}</p>
      <div className="mt-(--space-2) flex flex-wrap justify-center gap-(--space-3)">
        <Button href={clearHref} variant="secondary">
          {t('clear')}
        </Button>
        <Button href="/contact" variant="ghost">
          {t('contact')}
        </Button>
      </div>
    </section>
  );
}
