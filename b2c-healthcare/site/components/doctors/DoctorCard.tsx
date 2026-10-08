import { useLocale, useTranslations } from 'next-intl';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClasses } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import { doctorHref } from '@/lib/doctor-back';
import { formatMoney } from '@/lib/utils';
import type { ConsultationMode, DoctorListItem } from '@/lib/types';
import { AvailabilityBadge } from './AvailabilityBadge';

/**
 * One doctor. The card is a real link (the name is the link, stretched over the whole card with a pseudo
 * element), so it is keyboard reachable and announced once. Below 900 px (the `nav` breakpoint) the right
 * column drops under the text and spans the full width.
 */
export function DoctorCard({ doctor, mode, from }: { doctor: DoctorListItem; mode: ConsultationMode; /** The list URL (locale-less, with its filters) the profile's back link returns to. */ from?: string }) {
  const t = useTranslations('doctors.card');
  const locale = useLocale();
  const fee = doctor.fees[mode];
  const rating = doctor.rating === null ? t('noReviews') : t('rating', { rating: doctor.rating, count: doctor.reviewCount });
  return (
    <article
      data-testid="doctor-card"
      className="relative grid grid-cols-[auto_1fr] items-center gap-4 rounded-lg bg-surface p-5 shadow-sm hover:shadow-md nav:grid-cols-[auto_1fr_auto]"
    >
      <Avatar initials={doctor.initials} src={doctor.portraitUrl} name={doctor.name} />
      <div>
        <h3 className="font-display text-lg font-semibold text-brand-700">
          <Link href={doctorHref(doctor.key, mode, from)} className="after:absolute after:inset-0 after:content-['']">
            {doctor.name}
          </Link>
        </h3>
        <p className="text-sm text-neutral-600">
          {doctor.specialty} · {t('experience', { years: doctor.yearsExperience })}
        </p>
        <p className="text-sm text-neutral-600">
          {rating}
          {mode === 'office' && doctor.clinicName ? ` · ${doctor.clinicName}` : ''}
        </p>
      </div>
      <div
        data-testid="doctor-card-aside"
        className="col-span-2 grid justify-items-start gap-2 nav:col-span-1 nav:justify-items-end nav:text-right"
      >
        <AvailabilityBadge next={doctor.next} />
        <p className="font-bold text-navy-700">{fee ? formatMoney(fee.centAmount, fee.currencyCode, locale) : t('noPrice')}</p>
        <span aria-hidden="true" className={buttonClasses({ size: 'sm' })}>
          {t('viewProfile')}
        </span>
      </div>
    </article>
  );
}
