import { useTranslations } from 'next-intl';
import { ButtonLink } from '@/components/ui/Button';
import { HomeImage } from './HomeImage';

export interface RxDeliveryProps {
  /** A same-day shipping method exists (D-014). Without one the same-day claim is not shown. */
  sameDay: boolean;
  /** Auto-refills are shipped (workstream T). Defaults to false in config until then. */
  autoRefill: boolean;
}

/**
 * "Your prescription, delivered": a checklist and two calls to action. Claims the service cannot honor are
 * capability-gated (same-day, auto-refill); the prototype's pharmacist chat is removed (no such feature).
 */
export function RxDelivery({ sameDay, autoRefill }: RxDeliveryProps) {
  const t = useTranslations('home.rx');
  const items = [t('lookup'), t('standard'), ...(sameDay ? [t('sameDay')] : []), ...(autoRefill ? [t('autoRefill')] : [])];
  return (
    <section id="pharmacy" aria-labelledby="home-rx-title" className="bg-surface-subtle py-22">
      <div className="mx-auto grid max-w-content items-center gap-14 px-5 nav:grid-cols-2 nav:px-8">
        <HomeImage gradient="bg-(image:--gradient-sky)" className="aspect-[1.1] rounded-xl border border-neutral-200" />
        <div>
          <h2 id="home-rx-title" className="font-display text-[length:clamp(1.625rem,3.4vw,2.25rem)] leading-tight font-semibold text-text-heading">
            {t('title')}
          </h2>
          <p className="mt-3 text-neutral-600">{t('lead')}</p>
          <ul aria-label={t('listLabel')} className="my-6 mb-8 grid list-none gap-3.5 p-0">
            {items.map((item) => (
              <li key={item} className="flex gap-3 text-[length:var(--text-md)]">
                <span aria-hidden="true" className="mt-0.5 grid size-5.5 flex-none place-items-center rounded-full bg-brand-100 text-xs text-brand-800">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/prescriptions">{t('order')}</ButtonLink>
            <ButtonLink href="/prescriptions" variant="outline">
              {t('find')}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
