'use client';
import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Inputs';
import { useListActions } from '@/hooks/use-lists';
import { Link, useRouter } from '@/i18n/routing';
import { formatIsoDate } from '@/lib/format-date';
import { HttpError } from '@/lib/http';
import { MAX_LIST_NAME, type ListSummary } from '@/lib/lists-types';

/** Name field + the two ways to start a list (empty, or from what is in the cart). */
function CreateList() {
  const t = useTranslations('lists');
  const router = useRouter();
  const { create } = useListActions();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<'empty' | 'cart' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(fromCart: boolean) {
    setBusy(fromCart ? 'cart' : 'empty');
    setError(null);
    try {
      await create(name, fromCart);
      setName('');
      router.refresh();
    } catch (e) {
      // 422 carries a readable sentence (empty name, empty cart); anything else is the generic failure.
      setError(e instanceof HttpError && e.status === 422 && e.message ? e.message : t('createFailed'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void submit(false);
      }}
    >
      <Input label={t('nameLabel')} placeholder={t('namePlaceholder')} value={name} maxLength={MAX_LIST_NAME} onChange={(e) => setName(e.target.value)} />
      <div className="flex flex-wrap gap-2.5">
        <Button type="submit" size="sm" busy={busy === 'empty'}>
          {busy === 'empty' ? t('creating') : t('create')}
        </Button>
        <Button variant="outline" size="sm" busy={busy === 'cart'} onClick={() => void submit(true)}>
          {t('fromCart')}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}

/** `/account/lists`: the customer's saved lists. `lists: null` means the read failed. */
export function ListsIndex({ lists }: { lists: ListSummary[] | null }) {
  const t = useTranslations('lists');
  const locale = useLocale();
  if (lists === null) {
    return (
      <p role="status" className="text-danger-700">
        {t('loadFailed')}
      </p>
    );
  }
  return (
    <div className="grid gap-4" data-lists>
      {lists.length === 0 ? (
        <EmptyState
          title={t('empty')}
          description={t('emptyHint')}
          action={
            <ButtonLink href="/prescriptions" variant="outline" size="sm">
              {t('fromRx')}
            </ButtonLink>
          }
        />
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0">
          {lists.map((list) => (
            <li key={list.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3" data-list-card>
                <div>
                  <h2 className="font-meta text-base font-bold text-navy-900">
                    <Link href={`/account/lists/${encodeURIComponent(list.id)}`} className="text-navy-900">
                      {list.name}
                    </Link>
                  </h2>
                  <p className="text-sm text-neutral-600">
                    {t('lineCount', { count: list.lineCount })} · {t('updated', { date: formatIsoDate(list.updatedAt.slice(0, 10), locale) })}
                  </p>
                </div>
                <ButtonLink href={`/account/lists/${encodeURIComponent(list.id)}`} variant="outline" size="sm">
                  {t('open')}
                </ButtonLink>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Card>
        <CreateList />
      </Card>
    </div>
  );
}
