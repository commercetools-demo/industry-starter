import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

const linkClass =
  'text-[14px] text-[color-mix(in_srgb,var(--color-text)_68%,transparent)] no-underline hover:text-accent';

type Column = { title: string; links: Array<{ label: string; href: string }> };

const CATEGORIES = ['freshProduce', 'dairyEggs', 'bakery', 'pantry', 'drinks', 'household'] as const;

/** Surface-colour band: brand blurb plus Shop, House and Help columns. Server Component. */
export function Footer() {
  const t = useTranslations('footer');
  const c = useTranslations('common');
  const columns: Column[] = [
    {
      title: t('shop.title'),
      links: CATEGORIES.map((key) => ({ label: t(`shop.${key}`), href: `/shop?category=${t(`slugs.${key}`)}` })),
    },
    {
      title: t('house.title'),
      links: [
        { label: t('house.about'), href: '/about' },
        { label: t('house.journal'), href: '/journal' },
      ],
    },
    {
      title: t('help.title'),
      links: [
        { label: t('help.faq'), href: '/faq' },
        { label: t('help.delivery'), href: '/policies/delivery' },
        { label: t('help.contact'), href: '/contact' },
      ],
    },
  ];
  return (
    <footer className="bg-surface px-(--space-4) py-[calc(var(--space-8)*1.4)] tablet:px-(--space-8)">
      <div className="mx-auto grid max-w-[1360px] grid-cols-1 gap-(--space-8) tablet:grid-cols-2 desktop:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <div className="mb-(--space-3) font-heading text-[26px]">{c('brand')}</div>
          <p className="max-w-[26em] text-[14px] leading-[1.7] text-[color-mix(in_srgb,var(--color-text)_65%,transparent)]">{t('blurb')}</p>
        </div>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h6 className="mb-(--space-3)">{column.title}</h6>
            <ul className="m-0 flex list-none flex-col gap-(--space-2) p-0">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
