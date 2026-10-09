'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useCancelBooking } from '@/hooks/use-bookings';
import { Link, useRouter } from '@/i18n/routing';
import type { AppointmentView, AppointmentsView } from '@/lib/account-types';

function useWhen() {
  const locale = useLocale();
  return (a: AppointmentView) => {
    const at = new Date(a.startsAt);
    return {
      date: new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: a.timezone }).format(at),
      time: new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone: a.timezone }).format(at),
    };
  };
}

function AppointmentCard({ a, onCancel }: { a: AppointmentView; onCancel: (a: AppointmentView) => void }) {
  const t = useTranslations('account.appointments');
  const when = useWhen()(a);
  return (
    <Card as="article" className="flex flex-wrap items-center justify-between gap-4" data-appointment={a.reference}>
      <div>
        <b className="block font-medium text-navy-900">{a.doctorName || t('doctorUnknown')}</b>
        <span className="text-sm text-text-muted">
          {t('dateAt', when)} · {a.mode === 'remote' ? t('video') : a.clinicName}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {a.status === 'cancelled' ? <Badge variant="neutral">{t('cancelled')}</Badge> : null}
        {a.status === 'completed' ? <Badge variant="ok">{t('completed')}</Badge> : null}
        <Badge variant="info">{a.reference}</Badge>
        {a.canCancel ? (
          <Button variant="outline" size="sm" onClick={() => onCancel(a)}>
            {t('cancel')}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * `/account/appointments`: upcoming first, past separated, an empty state with a link to book. Cancelling asks first,
 * works up to 2 h before the start and then refreshes the page (the slot is free again). `appointments: null` means
 * the booking store could not be read.
 */
export function AppointmentList({ appointments }: { appointments: AppointmentsView | null }) {
  const t = useTranslations('account.appointments');
  const toast = useToast();
  const router = useRouter();
  const cancelBooking = useCancelBooking();
  const when = useWhen();
  const [target, setTarget] = useState<AppointmentView | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const close = () => {
    setTarget(null);
    setProblem(null);
  };
  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    setProblem(null);
    const result = await cancelBooking(target.reference);
    setBusy(false);
    if (result.ok) {
      setTarget(null);
      toast.show({ message: t('cancelToast') });
      router.refresh();
    } else {
      setProblem(result.tooLate ? t('cancelTooLate') : t('cancelFailed'));
      if (result.tooLate) router.refresh();
    }
  };

  const title = (
    <h1 className="mb-4 font-display text-2xl font-semibold text-navy-900">{t('title')}</h1>
  );
  if (appointments === null) {
    return (
      <div>
        {title}
        <Card role="status" className="text-danger-700">
          {t('loadFailed')}
        </Card>
      </div>
    );
  }
  if (appointments.upcoming.length === 0 && appointments.past.length === 0) {
    return (
      <div>
        {title}
        <Card className="text-text-muted">
          {t('empty')}{' '}
          <Link href="/doctors/remote" className="text-text-link">
            {t('book')}
          </Link>
        </Card>
      </div>
    );
  }
  return (
    <div>
      {title}
      {appointments.upcoming.length > 0 ? (
        <section aria-label={t('upcoming')} className="mb-8 grid gap-3">
          <h2 className="font-display text-lg font-semibold text-navy-900">{t('upcoming')}</h2>
          {appointments.upcoming.map((a) => (
            <AppointmentCard key={a.reference} a={a} onCancel={setTarget} />
          ))}
          {appointments.upcoming.some((a) => a.canCancel) ? <p className="text-sm text-text-muted">{t('cancelPolicy')}</p> : null}
        </section>
      ) : null}
      {appointments.past.length > 0 ? (
        <section aria-label={t('past')} className="grid gap-3">
          <h2 className="font-display text-lg font-semibold text-navy-900">{t('past')}</h2>
          {appointments.past.map((a) => (
            <AppointmentCard key={a.reference} a={a} onCancel={setTarget} />
          ))}
        </section>
      ) : null}
      <Modal open={target !== null} onClose={close} title={t('cancelTitle')}>
        {target ? (
          <>
            <p>{t('cancelBody', { doctor: target.doctorName || t('doctorUnknown'), when: t('dateAt', when(target)) })}</p>
            {problem ? (
              <p role="alert" className="rounded-md bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-700">
                {problem}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="outline" onClick={close}>
                {t('keep')}
              </Button>
              <Button busy={busy} onClick={confirm}>
                {t('cancelConfirm')}
              </Button>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
