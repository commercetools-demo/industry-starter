import { useTranslations } from 'next-intl';
import { Photo } from '@/components/ui/Photo';
import { Link } from '@/i18n/routing';
import { HERO_GRID_IMAGES } from '@/lib/config/home-images';

type TileKey = keyof typeof HERO_GRID_IMAGES;

/** A spans 2x2 and E spans two columns (from `tablet`); the grid has 230 px rows. */
const TILES: { key: TileKey; href: '/shop' | '/journal'; span: string }[] = [
  { key: 'a', href: '/journal', span: 'tablet:col-span-2 tablet:row-span-2' },
  { key: 'b', href: '/shop', span: '' },
  { key: 'c', href: '/shop', span: '' },
  { key: 'd', href: '/shop', span: '' },
  { key: 'e', href: '/journal', span: 'tablet:col-span-2' },
];

/** Magazine grid hero: headline over five lifted photo tiles. */
export function HeroGrid() {
  const t = useTranslations('home.grid');
  return (
    <section data-hero="grid" className="pt-[35px]">
      <h1 className="m-0 mb-(--space-6) text-[40px] leading-[1.02] tablet:text-[62px]">{t('title')}</h1>
      <ul className="m-0 grid list-none auto-rows-[230px] grid-cols-1 gap-[17.6px] p-0 tablet:grid-cols-3">
        {TILES.map(({ key, href, span }) => (
          <li key={key} data-tile={key} className={span}>
            <Link href={href} className="lift relative block h-full rounded-[calc(var(--radius-lg)*1.15)] text-text no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
              <Photo src={HERO_GRID_IMAGES[key]} alt="" sizes="(min-width: 75rem) 640px, 100vw" priority={key === 'a'} className="h-full" />
              <span className="absolute bottom-(--space-4) left-(--space-4) rounded-full bg-bg px-(--space-4) py-(--space-2) text-[14px] font-semibold">{t(`tiles.${key}`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
