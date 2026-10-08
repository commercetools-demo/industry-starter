import { useLocale, useTranslations } from 'next-intl';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { DoctorProfile, DoctorReview } from '@/lib/types';

/** Header card: 104 px avatar or portrait, H1, specialty, rating and experience badges. */
export function ProfileHeader({ doctor }: { doctor: DoctorProfile }) {
  const t = useTranslations('doctor');
  return (
    <Card className="flex items-center gap-6">
      <Avatar initials={doctor.initials} src={doctor.portraitUrl} name={doctor.name} size="lg" />
      <div>
        <h1 className="font-display text-3xl font-semibold text-text-heading">{doctor.name}</h1>
        <p className="font-meta text-md text-neutral-600">{doctor.specialty}</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {doctor.rating !== null ? <Badge variant="ok">{t('rating', { rating: doctor.rating, count: doctor.reviewCount })}</Badge> : null}
          <Badge variant="info">{t('experience', { years: doctor.yearsExperience })}</Badge>
        </div>
      </div>
    </Card>
  );
}

/** About card: the bio, then Education, Languages and Clinic (rows without a value are left out). */
export function ProfileAbout({ doctor }: { doctor: DoctorProfile }) {
  const t = useTranslations('doctor');
  const rows: [string, string][] = [
    [t('education'), doctor.education],
    [t('languages'), doctor.languages.join(', ')],
    [t('clinic'), doctor.clinicName],
  ];
  return (
    <Card as="section" aria-labelledby="doctor-about" className="grid gap-3">
      <h2 id="doctor-about" className="font-display text-xl font-semibold text-text-heading">
        {t('about')}
      </h2>
      {doctor.bio ? <p className="text-neutral-700">{doctor.bio}</p> : null}
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="font-meta font-bold text-neutral-600">{label}</dt>
              <dd className="text-navy-900">{value}</dd>
            </div>
          ))}
      </dl>
    </Card>
  );
}

function monthYear(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

/** Patient reviews (verified ones only come in); the whole card is omitted when there are none. */
export function ProfileReviews({ reviews }: { reviews: DoctorReview[] }) {
  const t = useTranslations('doctor');
  const locale = useLocale();
  const shown = reviews.filter((review) => review.text || review.title);
  if (shown.length === 0) return null;
  return (
    <Card as="section" aria-labelledby="doctor-reviews" className="grid gap-4" data-testid="doctor-reviews">
      <h2 id="doctor-reviews" className="font-display text-xl font-semibold text-text-heading">
        {t('reviews')}
      </h2>
      <ul className="m-0 grid list-none gap-4 p-0">
        {shown.map((review) => (
          <li key={review.id}>
            <p className="text-neutral-700">“{review.text ?? review.title}”</p>
            <span className="font-meta text-sm text-neutral-600">{t('verified', { date: monthYear(review.createdAt, locale) })}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
