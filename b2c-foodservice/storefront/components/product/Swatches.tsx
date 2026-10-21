import { useTranslations } from 'next-intl';
import ColorSwatch from '@/components/ui/ColorSwatch';
import { MAX_SWATCHES } from '@/lib/product/swatches';

/** Colour dots for products whose variants differ by colour: at most four, then "+n". */
export default function Swatches({ swatches }: { swatches: { key: string; name: string }[] }) {
  const t = useTranslations('card');
  const shown = swatches.slice(0, MAX_SWATCHES);
  const more = swatches.length - shown.length;
  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('colours', { list: swatches.map((s) => s.name).join(', ') })}>
      {shown.map((s) => (
        <ColorSwatch key={s.key} colour={s.key} label={s.name} />
      ))}
      {more > 0 ? <span className="font-mono text-[11px] text-ink-3">{t('swatchMore', { n: more })}</span> : null}
    </div>
  );
}
