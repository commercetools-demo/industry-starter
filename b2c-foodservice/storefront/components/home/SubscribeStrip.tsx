import { useTranslations } from 'next-intl';
import ButtonLink from '@/components/ui/ButtonLink';
import { subscribableHref } from '@/lib/home-links';

const STEPS = ['step1', 'step2', 'step3'] as const;

/**
 * "Subscribe & save" strip (server). Rendered only when the catalogue has something to subscribe to. It names no saving
 * percent: the figure varies by product, so any number would be a hard-coded claim (Q-O-7).
 */
export default function SubscribeStrip({ available }: { available: boolean }) {
  const t = useTranslations('home.subscribe');
  if (!available) return null;
  return (
    <section aria-labelledby="home-subscribe-title" data-testid="home-subscribe" className="home-section-tight">
      <div className="wrap">
        <div className="rounded-panel border border-line bg-surface p-10 max-mobile:p-6">
          <p className="eyebrow m-0 mb-2 !text-ink-2">{t('eyebrow')}</p>
          <h2 id="home-subscribe-title" className="section-title m-0 text-ink">
            {t('title')}
          </h2>
          <ol aria-label={t('stepsAria')} className="m-0 mt-8 grid list-none grid-cols-3 gap-4 p-0 max-mobile:grid-cols-1">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-3.5 rounded-card bg-canvas-2 p-4">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-ink font-display text-[14px] font-bold text-surface"
                >
                  {i + 1}
                </span>
                <span className="text-[15px] font-medium text-ink">{t(step)}</span>
              </li>
            ))}
          </ol>
          <div className="mt-8">
            <ButtonLink href={subscribableHref()} size="lg">
              {t('cta')}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
