import { useLocale, useTranslations } from 'next-intl';
import { Stat } from '@/components/ui/content';
import type { Stat as StatItem } from '@/content/schema';
import { text } from '@/lib/content';
import { Sampled } from './Sampled';

/** Dark band of service figures; omitted when there are none. */
export function StatsBand({ items }: { items: StatItem[] }) {
  const t = useTranslations('home');
  const locale = useLocale();
  if (items.length === 0) return null;
  return (
    <section className="s d"><div className="wrap">
      <div className="sh"><div><h2>{t('statsTitle')}</h2><p>{t('statsLead')}</p></div></div>
      <div className="grid g4">
        {items.map((item) => <Sampled key={item.id} sample={item.sample} corner><Stat value={item.value} caption={text(item.caption, locale)} /></Sampled>)}
      </div>
    </div></section>
  );
}
