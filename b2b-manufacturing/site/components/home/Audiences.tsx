import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import type { Audience } from '@/content/schema';
import { text } from '@/lib/content';
import { ROUTES } from '@/lib/site';
import { Sampled } from './Sampled';

/** One card per audience, each a link to the quote form with the sector preselected. */
export function Audiences({ items }: { items: Audience[] }) {
  const t = useTranslations('home');
  const locale = useLocale();
  if (items.length === 0) return null;
  return (
    <section className="s"><div className="wrap">
      <div className="sh"><div><h2>{t('audiencesTitle')}</h2></div></div>
      <div className="grid g4">
        {items.map((item) => (
          <Sampled key={item.id} sample={item.sample}>
            <Link className="card" href={`${ROUTES.quote}?sector=${item.sector}`} style={{ height: '100%' }}>
              <div className="b"><h3>{text(item.title, locale)}</h3><p>{text(item.body, locale)}</p></div>
            </Link>
          </Sampled>
        ))}
      </div>
    </div></section>
  );
}
