import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Link } from '@/i18n/routing';
import type { BookingView } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

function whenParts(startsAt: string, timezone: string, locale: string): { date: string; time: string; zone: string } {
  const at = new Date(startsAt);
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: timezone, ...options });
  const zone = part({ timeZoneName: 'short' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? timezone;
  return {
    date: part({ dateStyle: 'long' }).format(at),
    time: part({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at),
    zone,
  };
}

export interface BookingConfirmationProps {
  booking: BookingView;
  /** True when the visitor is signed in (then "My appointments" replaces the guest nudge). */
  signedIn: boolean;
}

/**
 * "Booking confirmed" card. No email is sent, so the copy tells the visitor to keep the reference, never that
 * a confirmation was sent. It shows no reason, phone or email.
 */
export function BookingConfirmation({ booking, signedIn }: BookingConfirmationProps) {
  const t = useTranslations('booking.confirmed');
  const locale = useLocale();
  const when = whenParts(booking.startsAt, booking.timezone, locale);
  const remote = booking.mode === 'remote';
  const rows: [string, string][] = [
    [t('reference'), booking.reference],
    ...(booking.doctorName ? ([[t('doctor'), t('doctorValue', { name: booking.doctorName, specialty: booking.specialty })]] as [string, string][]) : []),
    [t('when'), t('whenValueZone', { date: when.date, time: when.time, zone: when.zone })],
    [t('type'), t(remote ? 'typeRemote' : 'typeOffice')],
    ...(remote
      ? ([[t('join'), t(booking.guest ? 'joinGuest' : 'joinPatient')]] as [string, string][])
      : booking.clinicName
        ? ([[t('where'), booking.clinicName]] as [string, string][])
        : []),
    [t('fee'), booking.fee ? t('feeValue', { amount: formatMoney(booking.fee.centAmount, booking.fee.currencyCode, locale) }) : t('feeValueUnknown')],
  ];
  return (
    <div className="mx-auto max-w-160 px-5 nav:px-8">
      <Card className="mt-12 grid gap-4" data-testid="booking-confirmation">
        <Badge variant="ok" className="justify-self-start">
          {t('badge')}
        </Badge>
        <h1 className="font-display text-3xl font-semibold text-text-heading">{booking.firstName ? t('title', { name: booking.firstName }) : t('titleNoName')}</h1>
        <p className="text-neutral-700">{t(booking.guest ? 'keepReference' : 'keepReferencePatient', { reference: booking.reference })}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="font-meta font-bold text-neutral-600">{label}</dt>
              <dd className="text-navy-900">{value}</dd>
            </div>
          ))}
        </dl>
        {booking.guest && !signedIn ? (
          <p className="rounded-md bg-brand-50 p-3.5 text-sm text-navy-900" data-testid="guest-nudge">
            {t('guestNudge')}{' '}
            <Link href={{ pathname: '/login', query: { mode: 'register' } }} className="font-medium text-brand-800 hover:text-brand-900">
              {t('createAccount')}
            </Link>{' '}
            {t('guestNudgeTail')}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          {signedIn ? <ButtonLink href="/account/appointments">{t('myAppointments')}</ButtonLink> : <ButtonLink href="/doctors/remote">{t('bookAnother')}</ButtonLink>}
          <ButtonLink href="/" variant="outline">
            {t('home')}
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}
