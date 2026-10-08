'use client';

import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { useAddresses } from '@/hooks/useAddresses';
import { validateAddress } from '@/lib/addresses/validate';
import { isValidEmail } from '@/lib/checkout/steps';
import { Link } from '@/i18n/routing';
import { cx } from '@/lib/cx';
import { FOCUS_RING } from '@/components/ui/focus';
import type { CheckoutApi } from './types';
import { useCheckoutErrorText } from './useCheckoutError';

type Props = {
  checkout: CheckoutApi;
  phone: string;
  onPhone: (phone: string) => void;
  onDone: () => void;
};

const LINK = cx('font-display text-sm font-semibold underline underline-offset-4', FOCUS_RING);

/** Step 1: email (read-only for a signed-in buyer, D-035 guests may type one) and an optional mobile phone. */
export function ContactStep({ checkout, phone, onPhone, onDone }: Props): ReactElement {
  const t = useTranslations('checkout');
  const errorText = useCheckoutErrorText();
  const { state } = checkout;
  const { defaultService } = useAddresses({ enabled: state.signedIn });
  const [email, setEmail] = useState(state.email ?? '');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // The phone starts from the default service address of a signed-in buyer, once.
  useEffect(() => {
    if (phone === '' && defaultService?.phone) onPhone(defaultService.phone);
  }, [defaultService, phone, onPhone]);

  const emailValid = isValidEmail(email.trim());
  const phoneError = phone.trim() !== '' && validateAddress({ phone }).phone ? t('contact.phoneInvalid') : undefined;
  const emailError = touched && !emailValid ? t('contact.emailInvalid') : undefined;

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setTouched(true);
    if (!emailValid || phoneError) return;
    setFailure(null);
    if (state.signedIn || email.trim() === state.email) {
      onDone();
      return;
    }
    setBusy(true);
    try {
      await checkout.saveDetails({ email: email.trim() });
      onDone();
    } catch (error) {
      setFailure(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6" aria-labelledby="checkout-contact">
      <h2 id="checkout-contact" className="m-0 font-display text-2xl font-bold tracking-ui">
        {t('contact.heading')}
      </h2>
      <Field label={t('contact.email')} htmlFor="checkout-email" {...(emailError ? { error: emailError } : {})} {...(state.signedIn ? { hint: t('contact.accountEmail') } : {})}>
        <Input id="checkout-email" type="email" autoComplete="email" value={email} readOnly={state.signedIn} onChange={(event) => {
            setEmail(event.target.value);
            setTouched(true);
          }} />
      </Field>
      <Field label={t('contact.phone')} htmlFor="checkout-phone" {...(phoneError ? { error: phoneError } : {})}>
        <Input id="checkout-phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => onPhone(event.target.value)} />
      </Field>
      {!state.signedIn ? (
        <div className="flex flex-col gap-3">
          <Link href="/login?next=%2Fbundle%2Fcheckout" className={LINK}>
            {t('contact.signIn')}
          </Link>
          {state.needsCustomer ? (
            <p role="note" className="m-0 rounded-lg border border-border bg-brand-100 p-4 text-sm">
              {t('contact.signInRequired')}{' '}
              <Link href="/register" className={LINK}>
                {t('contact.createAccount')}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
      {failure ? (
        <p role="alert" className="m-0 text-sm text-danger">
          {failure}
        </p>
      ) : null}
      <div>
        <Button type="submit" loading={busy} disabled={!emailValid}>
          {t('continue')}
        </Button>
      </div>
    </form>
  );
}
