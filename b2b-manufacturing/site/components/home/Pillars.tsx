import { useTranslations } from 'next-intl';
import { ServiceCard } from '@/components/ui/content';
import type { SiteImage } from '@/content/images';
import { ROUTES } from '@/lib/site';

export function Pillars({ plumbingImage, wasteImage }: { plumbingImage?: SiteImage; wasteImage?: SiteImage }) {
  const t = useTranslations('home');
  return (
    <section className="s"><div className="wrap">
      <div className="sh"><div><h2>{t('pillarsTitle')}</h2><p>{t('pillarsLead')}</p></div></div>
      <div className="grid g2">
        <ServiceCard href={ROUTES.plumbing} name={t('plumbingName')} summary={t('plumbingSummary')} more={t('plumbingMore')} imageUrl={plumbingImage?.url} />
        <ServiceCard href={ROUTES.waste} name={t('wasteName')} summary={t('wasteSummary')} more={t('wasteMore')} imageUrl={wasteImage?.url} />
      </div>
    </div></section>
  );
}
