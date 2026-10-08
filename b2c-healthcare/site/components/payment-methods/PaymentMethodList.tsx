'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RefillDepends, useMethodActions } from '@/hooks/use-payment-methods';
import { useRouter } from '@/i18n/routing';
import type { StoredMethodDescriptor } from '@/lib/checkout/payment-provider';

type Notice = { kind: 'defaultRemoved' } | { kind: 'removed' } | { kind: 'paused'; count: number };

function MethodCard({ method, onNotice }: { method: StoredMethodDescriptor; onNotice: (n: Notice) => void }) {
  const t = useTranslations('paymentMethods');
  const router = useRouter();
  const { makeDefault, remove } = useMethodActions();
  const [busy, setBusy] = useState<'default' | 'remove' | null>(null);
  const [depends, setDepends] = useState<number | null>(null);
  const [error, setError] = useState(false);

  const card = method.last4 ? t('card', { brand: method.brand, last4: method.last4 }) : t('cardNoDigits', { brand: method.brand });

  async function onDefault() {
    setBusy('default');
    setError(false);
    try {
      await makeDefault(method.id);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }

  async function onRemove(confirm: boolean) {
    setBusy('remove');
    setError(false);
    try {
      const answer = await remove(method.id, confirm);
      onNotice(answer.pausedRefills > 0 ? { kind: 'paused', count: answer.pausedRefills } : answer.wasDefault ? { kind: 'defaultRemoved' } : { kind: 'removed' });
      router.refresh();
    } catch (e) {
      if (e instanceof RefillDepends) setDepends(e.count);
      else setError(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card as="article" className="grid gap-3" data-method-card data-default={method.isDefault || undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-meta text-base font-bold text-navy-900">{card}</h2>
          {method.expMonth && method.expYear ? <p className="text-sm text-neutral-600">{t('expires', { month: String(method.expMonth).padStart(2, '0'), year: method.expYear })}</p> : null}
        </div>
        {method.isDefault ? <Badge variant="ok">{t('default')}</Badge> : null}
      </div>
      {depends !== null ? (
        <div role="alert" className="grid gap-2 rounded-md bg-warning-50 px-3.5 py-2.5 text-sm text-navy-900" data-refill-warning>
          <p>{t('dependsWarning', { count: depends })}</p>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="navy" size="sm" busy={busy === 'remove'} onClick={() => void onRemove(true)}>
              {t('removeAnyway')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDepends(null)}>
              {t('keep')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          {!method.isDefault ? (
            <Button variant="outline" size="sm" busy={busy === 'default'} aria-label={t('makeDefaultLabel', { card })} onClick={() => void onDefault()}>
              {t('makeDefault')}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" busy={busy === 'remove'} aria-label={t('removeLabel', { card })} onClick={() => void onRemove(false)}>
            {t('remove')}
          </Button>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger-700">
          {t('failed')}
        </p>
      ) : null}
    </Card>
  );
}

/**
 * `/account/payment-methods`: saved cards by brand, last four digits, expiry and default flag. The provider token never
 * reaches this component (it is not part of `StoredMethodDescriptor`). `methods: null` means the read failed.
 */
export function PaymentMethodList({ methods }: { methods: StoredMethodDescriptor[] | null }) {
  const t = useTranslations('paymentMethods');
  const [notice, setNotice] = useState<Notice | null>(null);
  if (methods === null) {
    return (
      <p role="status" className="text-danger-700">
        {t('loadFailed')}
      </p>
    );
  }
  return (
    <div className="grid gap-4" data-payment-methods>
      {notice ? (
        <p role="status" className="rounded-md bg-info-50 px-3.5 py-2.5 text-sm text-navy-900" data-method-notice={notice.kind}>
          {notice.kind === 'defaultRemoved' ? t('defaultRemoved') : notice.kind === 'paused' ? t('refillsPaused', { count: notice.count }) : t('removed')}
        </p>
      ) : null}
      {methods.length === 0 ? (
        <Card className="grid justify-items-center gap-3 py-10 text-center" data-methods-empty>
          <h2 className="font-display text-xl font-semibold text-navy-900">{t('empty')}</h2>
          <p className="max-w-120 text-neutral-600">{t('emptyHint')}</p>
          <ButtonLink href="/cart" variant="outline" size="sm">
            {t('addAtCheckout')}
          </ButtonLink>
        </Card>
      ) : (
        methods.map((m) => <MethodCard key={m.id} method={m} onNotice={setNotice} />)
      )}
      <p className="text-sm text-neutral-600">{t('note')}</p>
    </div>
  );
}
