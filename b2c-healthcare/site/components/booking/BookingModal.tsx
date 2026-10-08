'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Inputs';
import { Modal } from '@/components/ui/Modal';
import { Link, useRouter } from '@/i18n/routing';
import { API_BOOKINGS } from '@/lib/api-paths';
import { validateBookingContact, type BookingField, type BookingProblems } from '@/lib/booking-validation';
import { fetchJson, HttpError } from '@/lib/http';
import type { BookingCreated, ConsultationMode } from '@/lib/types';

export interface BookingPatient {
  name: string;
  email: string;
}

export interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  doctor: { key: string; name: string };
  mode: ConsultationMode;
  /** Clinic-local date line, already formatted ("October 9, 2026"). */
  dateText: string;
  /** Clinic-local `HH:mm`. */
  time: string;
  /** UTC instant the booking request sends. */
  startsAt: string;
  /** Formatted fee, or null when none resolves (booking is then not offered). */
  feeText: string | null;
  /** Signed-in patient; null for a guest. */
  patient: BookingPatient | null;
  /** Called when the platform says the time is gone, so the grid can refetch. */
  onTaken: () => void;
}

type Failure = 'taken' | 'tooMany' | 'failed';

const FIELD_ORDER: BookingField[] = ['name', 'email', 'phone', 'reason'];

/**
 * Confirm booking dialog. A guest gives name, email, phone and reason; a signed-in patient only phone and reason
 * (name and email show as text). The reason is health data: it lives in component state until the POST, is never
 * logged or put in a URL, and the error texts below never repeat it.
 */
export function BookingModal({ open, onClose, doctor, mode, dateText, time, startsAt, feeText, patient, onTaken }: BookingModalProps) {
  const t = useTranslations('booking.modal');
  const locale = useLocale();
  const router = useRouter();
  const guest = patient === null;
  const [values, setValues] = useState({ name: '', email: '', phone: '', reason: '' });
  const [problems, setProblems] = useState<BookingProblems>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // One request id per slot choice: a retry after a dropped connection finds the same booking instead of making a second one.
  const requestId = useRef<{ slot: string; id: string } | null>(null);

  const set = (field: BookingField) => (event: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setProblems((current) => ({ ...current, [field]: undefined }));
  };
  const problem = (field: BookingField) => (problems[field] ? t(`problems.${problems[field]}`) : undefined);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || failure === 'taken') return;
    const found = validateBookingContact(values, { guest });
    setProblems(found);
    const firstBad = FIELD_ORDER.find((field) => found[field]);
    if (firstBad) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstBad}"]`)?.focus();
      return;
    }
    if (requestId.current?.slot !== startsAt) requestId.current = { slot: startsAt, id: crypto.randomUUID() };
    setBusy(true);
    setFailure(null);
    try {
      const { reference } = await fetchJson<BookingCreated>(API_BOOKINGS, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          requestId: requestId.current.id,
          doctorKey: doctor.key,
          mode,
          startsAt,
          phone: values.phone,
          reason: values.reason,
          ...(guest ? { name: values.name, email: values.email } : {}),
        }),
      });
      router.push(`/booked/${reference}`);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 0;
      if (status === 409) {
        setFailure('taken');
        onTaken();
      } else {
        setFailure(status === 429 ? 'tooMany' : 'failed');
      }
      setBusy(false);
    }
  }

  const next = `/${locale}/doctor/${doctor.key}?m=${mode}`;
  return (
    <Modal open={open} onClose={onClose} title={t('title')}>
      <form ref={formRef} onSubmit={submit} noValidate className="grid gap-4">
        <div className="rounded-md bg-brand-50 p-3.5 text-sm text-navy-900" data-testid="booking-summary">
          <b>{t('summary', { doctor: doctor.name, type: t(mode === 'remote' ? 'typeRemote' : 'typeOffice') })}</b>
          <br />
          {t('when', { date: dateText, time, fee: feeText ?? '' })}
        </div>
        {patient ? (
          <p className="font-meta text-sm text-neutral-600">{t('asPatient', { name: patient.name, email: patient.email })}</p>
        ) : (
          <p className="font-meta text-sm text-neutral-600">
            {t('asGuest')}{' '}
            <Link href={{ pathname: '/login', query: { next } }} className="text-brand-700 hover:text-brand-800">
              {t('signIn')}
            </Link>
          </p>
        )}
        {guest ? (
          <>
            <Input name="name" label={t('name')} autoComplete="name" required value={values.name} onChange={set('name')} error={problem('name')} />
            <Input name="email" type="email" label={t('email')} autoComplete="email" required value={values.email} onChange={set('email')} error={problem('email')} />
          </>
        ) : null}
        <Input
          name="phone"
          type="tel"
          label={t('phone')}
          autoComplete="tel"
          placeholder={t('phonePlaceholder')}
          required
          value={values.phone}
          onChange={set('phone')}
          error={problem('phone')}
        />
        <Textarea
          name="reason"
          label={t('reason')}
          placeholder={t('reasonPlaceholder')}
          required
          autoComplete="off"
          value={values.reason}
          onChange={set('reason')}
          error={problem('reason')}
        />
        <p className="text-xs text-neutral-600" data-testid="booking-consent">
          {t(guest ? 'consent' : 'consentPatient')}
        </p>
        {failure ? (
          <p role="alert" className="text-sm font-medium text-danger-700">
            {failure === 'taken' ? t('taken') : failure === 'tooMany' ? t('tooMany') : t('failed')}
          </p>
        ) : null}
        <Button type="submit" full busy={busy} disabled={failure === 'taken'}>
          {busy ? t('confirming') : t('confirm')}
        </Button>
      </form>
    </Modal>
  );
}
