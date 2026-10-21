import { useTranslations } from 'next-intl';
import OpenStoreButton from '@/components/home/OpenStoreButton';
import { buttonClasses } from '@/components/ui/Button';
import Icon, { type IconName } from '@/components/ui/Icon';
import { Link } from '@/i18n/routing';
import { collectEligibleHref } from '@/lib/home-links';
import type { Store } from '@/lib/types';

const PROOF: Array<{ icon: IconName; title: 'proofFast' | 'proofReserved' | 'proofNoFees'; text: 'proofFastText' | 'proofReservedText' | 'proofNoFeesText' }> = [
  { icon: 'clock', title: 'proofFast', text: 'proofFastText' },
  { icon: 'shield', title: 'proofReserved', text: 'proofReservedText' },
  { icon: 'leaf', title: 'proofNoFees', text: 'proofNoFeesText' },
];

/**
 * Ink panel that sells collection (server). `store` is the shopper's chosen store, read from the session on the server
 * per request (never cached); null names no store. The page renders this only in a market with collection. It shows no
 * name, cart count or other personal data.
 */
export default function CollectionBanner({ store }: { store: Pick<Store, 'name' | 'collectionMinutes'> | null }) {
  const t = useTranslations('home.banner');
  return (
    <section aria-labelledby="home-banner-title" className="home-section-tight">
      <div className="wrap">
        <div className="relative overflow-hidden rounded-hero bg-ink p-11 text-surface max-mobile:p-7">
          <div aria-hidden="true" className="home-glow-dark absolute -right-24 -top-24 h-[420px] w-[420px]" />
          <div className="relative grid items-center gap-10 stack:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div>
              <p className="eyebrow m-0 mb-3 !text-teal">{t('eyebrow')}</p>
              <h2 id="home-banner-title" className="m-0 font-display text-[34px] font-bold leading-[1.1] tracking-[-0.02em] max-mobile:text-[27px]">
                {store ? t('titleStore', { minutes: store.collectionMinutes, store: store.name }) : t('titleNoStore')}
              </h2>
              <p className="home-banner-body mb-0 mt-4 max-w-[480px] text-[16px] leading-relaxed">{t('text')}</p>
              <div className="mt-7 flex flex-wrap gap-3 max-xs:flex-col">
                <OpenStoreButton variant="accent">{store ? t('changeStore') : t('chooseStore')}</OpenStoreButton>
                {store ? (
                  <Link href={collectEligibleHref()} className={`${buttonClasses({ variant: 'ghost' })} !border-surface/40 !text-surface hover:!border-surface`}>
                    {t('shopCollect')}
                  </Link>
                ) : (
                  <OpenStoreButton variant="ghost" pin={false} className="!border-surface/40 !text-surface hover:!border-surface">
                    {t('shopCollect')}
                  </OpenStoreButton>
                )}
              </div>
            </div>
            <ul className="m-0 flex list-none flex-col gap-3 p-0 max-stack:flex-row max-stack:flex-wrap">
              {PROOF.map((item) => (
                <li key={item.title} className="home-proof flex min-w-[260px] flex-1 items-start gap-3.5 rounded-card p-4 max-narrow:min-w-full">
                  <Icon name={item.icon} size={22} className="mt-0.5 shrink-0 text-teal" />
                  <span>
                    <span className="block font-display text-[15px] font-semibold">{t(item.title)}</span>
                    <span className="home-banner-body block text-[13.5px]">{t(item.text)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
