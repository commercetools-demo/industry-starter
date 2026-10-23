import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';

/** Three reassurance items under the add button. The return window is the market's figure, never the prototype's 90 days. */
export default function TrustRow({ returnDays }: { returnDays: number }) {
  const t = useTranslations('pdp.trust');
  const items = [
    { icon: 'repeat', text: t('returns', { days: returnDays }) },
    { icon: 'shield', text: t('quality') },
    { icon: 'leaf', text: t('sourced') },
  ] as const;
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-[12.5px] text-ink-3" data-testid="pdp-trust">
      {items.map((i) => (
        <li key={i.icon} className="flex items-center gap-1.5">
          <Icon name={i.icon} size={16} />
          {i.text}
        </li>
      ))}
    </ul>
  );
}
