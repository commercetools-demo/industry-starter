import { useLocale, useTranslations } from 'next-intl';
import { AvailabilityBadge } from '@/components/doctors/AvailabilityBadge';
import { Avatar } from '@/components/ui/Avatar';
import { ButtonLink } from '@/components/ui/Button';
import type { AvailableToday as AvailableTodayData, HomeDoctor } from '@/lib/ct/home';
import { formatMoney } from '@/lib/utils';

function HomeDoctorCard({ entry }: { entry: HomeDoctor }) {
  const t = useTranslations('home.available');
  const card = useTranslations('doctors.card');
  const locale = useLocale();
  const { doctor, mode } = entry;
  const fee = doctor.fees[mode];
  return (
    <article data-testid="home-doctor-card" className="flex flex-col gap-4 rounded-lg bg-surface p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <Avatar initials={doctor.initials} src={doctor.portraitUrl} name={doctor.name} />
        <div>
          <h3 className="font-display text-lg font-semibold text-brand-700">{doctor.name}</h3>
          <p className="font-meta text-sm text-neutral-600">
            {doctor.specialty} · {card('experience', { years: doctor.yearsExperience })}
          </p>
          <p className="font-meta text-sm text-neutral-600">
            {doctor.rating === null ? card('noReviews') : card('rating', { rating: doctor.rating, count: doctor.reviewCount })}
          </p>
        </div>
      </div>
      <AvailabilityBadge next={doctor.next} />
      <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
        <span>
          {t(`mode.${mode}`)} · <b className="text-navy-700">{fee ? formatMoney(fee.centAmount, fee.currencyCode, locale) : card('noPrice')}</b>
        </span>
        <ButtonLink href={`/doctor/${doctor.key}?m=${mode}`} size="sm" aria-label={t('bookWith', { name: doctor.name })}>
          {t('book')}
        </ButtonLink>
      </div>
    </article>
  );
}

/**
 * Up to three doctors from the live schedules: with a slot today ("Available today"), else with their next
 * day ("Next: Tue 14"), else the section is not rendered. Never a fixed list.
 */
export function AvailableToday({ data }: { data: AvailableTodayData | null }) {
  const t = useTranslations('home.available');
  if (!data || data.state === 'none' || data.items.length === 0) return null;
  return (
    <section id="doctors" aria-labelledby="home-available-title" className="py-22">
      <div className="mx-auto max-w-content px-5 nav:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 id="home-available-title" className="font-display text-[length:clamp(1.625rem,3.4vw,2.25rem)] leading-tight font-semibold text-text-heading">
              {t('title')}
            </h2>
            <p className="mt-2 max-w-120 text-neutral-600">{data.state === 'today' ? t('sub') : t('subNext')}</p>
          </div>
          <ButtonLink href="/doctors/remote" variant="outline">
            {t('viewAll')}
          </ButtonLink>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18.75rem),1fr))] gap-6">
          {data.items.map((entry) => (
            <HomeDoctorCard key={entry.doctor.key} entry={entry} />
          ))}
        </div>
      </div>
    </section>
  );
}
