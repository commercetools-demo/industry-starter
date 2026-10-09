import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import type { Overview, Section } from '@/lib/account-types';
import { LabRows } from './LabRows';

function Tile({ href, label, section, count }: { href: string; label: string; section: Section<unknown>; count: number }) {
  const t = useTranslations('account.overview');
  return (
    <Link href={href} className="block rounded-lg bg-surface p-5 shadow-sm hover:bg-brand-50" data-tile={section.status}>
      {section.status === 'ok' ? (
        <b className="block font-display text-3xl font-semibold text-navy-900">{count}</b>
      ) : (
        <span className="block text-sm font-medium text-danger-700">{t('unavailable')}</span>
      )}
      <span className="text-sm text-text-muted">{label}</span>
    </Link>
  );
}

/**
 * Overview (account-dashboard): greeting, three tiles and the latest lab results. Every summary renders, with a
 * zero or an explicit "couldn't load" when its service is down; none is hidden and none blanks the others.
 */
export function OverviewView({ overview }: { overview: Overview }) {
  const t = useTranslations('account.overview');
  const { user, labs, appointments, orders } = overview;
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-navy-900">
          {user.status === 'ok' && user.data.firstName ? t('greeting', { name: user.data.firstName }) : t('greetingNoName')}
        </h1>
        <p className="text-text-muted">{user.status === 'ok' ? user.data.email : t('userUnavailable')}</p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <Tile href="/account/labs" label={t('tileLabs')} section={labs} count={labs.status === 'ok' ? labs.data.ready : 0} />
        <Tile href="/account/appointments" label={t('tileAppointments')} section={appointments} count={appointments.status === 'ok' ? appointments.data.upcoming : 0} />
        <Tile href="/account/orders" label={t('tileOrders')} section={orders} count={orders.status === 'ok' ? orders.data.count : 0} />
      </div>
      <section aria-labelledby="latest-labs" className="rounded-lg bg-surface shadow-sm">
        <h2 id="latest-labs" className="px-5 pt-5 pb-2 font-display text-xl font-semibold text-navy-900">
          {t('latestTitle')}
        </h2>
        {labs.status === 'error' ? (
          <p className="px-5 pb-5 text-danger-700" role="status">
            {t('latestUnavailable')}
          </p>
        ) : labs.data.latest.length === 0 ? (
          <p className="px-5 pb-5 text-text-muted">{t('latestEmpty')}</p>
        ) : (
          <LabRows labs={labs.data.latest} />
        )}
      </section>
    </div>
  );
}
