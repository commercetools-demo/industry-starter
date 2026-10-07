'use client';

import { useState, type ReactElement } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { SWRConfig } from 'swr';
import { Button } from '@/components/ui/Button';
import { FOCUS_RING } from '@/components/ui/focus';
import { AccountApiError } from '@/hooks/accountRequest';
import { useCart } from '@/hooks/useCart';
import { useListMutations, useLists } from '@/hooks/useLists';
import { Link, useRouter } from '@/i18n/routing';
import { KEY_LISTS } from '@/lib/cache-keys';
import { LIST_NAME_MAX, MAX_LISTS } from '@/lib/config/lists';
import { cx } from '@/lib/cx';
import type { SavedList } from '@/lib/types';
import { ListNameForm } from './ListNameForm';

type Creating = { fromCart: boolean } | null;

function Index(): ReactElement {
  const t = useTranslations('account.lists');
  const format = useFormatter();
  const router = useRouter();
  const { lists } = useLists();
  const { create } = useListMutations();
  const { cart } = useCart();
  const [creating, setCreating] = useState<Creating>(null);
  const bundleEmpty = (cart?.lines.length ?? 0) === 0;

  async function submit(name: string): Promise<void> {
    try {
      const list = await create(name, creating?.fromCart === true);
      router.push(`/account/lists/${list.id}`);
    } catch (error) {
      if (error instanceof AccountApiError && error.code === 'LIST_LIMIT') throw new Error(t('limit', { max: MAX_LISTS }));
      throw error instanceof AccountApiError && error.code === 'INVALID_NAME' ? new Error(t('errors.invalidName', { max: LIST_NAME_MAX })) : new Error(t('errors.generic'));
    }
  }

  const form = creating ? (
    <ListNameForm submitLabel={t('name.create')} onSubmit={submit} onCancel={() => setCreating(null)} />
  ) : null;

  if (lists.length === 0) {
    return (
      <div className="flex flex-col gap-7">
        <section aria-labelledby="lists-empty-title" className="flex flex-col items-center gap-5 rounded-xl border border-border bg-surface p-9 text-center">
          <h2 id="lists-empty-title" className="m-0 font-display text-2xl font-bold">
            {t('empty.title')}
          </h2>
          <p className="m-0 max-w-prose text-md">{t('empty.body')}</p>
          <div className="flex flex-col items-center gap-3">
            <Button disabled={bundleEmpty} aria-describedby={bundleEmpty ? 'lists-bundle-empty' : undefined} onClick={() => setCreating({ fromCart: true })}>
              {t('empty.cta')}
            </Button>
            {bundleEmpty ? (
              <p id="lists-bundle-empty" className="m-0 text-sm text-text-muted">
                {t('empty.bundleEmpty')}
              </p>
            ) : null}
          </div>
          <Link href="/shop/phone-plans" className={cx('font-display text-sm font-semibold text-text-link underline underline-offset-4', FOCUS_RING)}>
            {t('browse')}
          </Link>
        </section>
        {form}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <ul className="m-0 grid list-none gap-7 p-0 [grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr))]">
        {lists.map((list: SavedList) => (
          <li key={list.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-7">
            <Link href={`/account/lists/${list.id}`} className={cx('font-display text-lg font-bold text-text no-underline hover:underline', FOCUS_RING)}>
              {list.name}
            </Link>
            <span className="text-md">{t('items', { count: list.lineCount })}</span>
            <span className="text-sm text-text-muted">{t('updated', { date: format.dateTime(new Date(list.updatedAt), { dateStyle: 'medium' }) })}</span>
          </li>
        ))}
      </ul>
      {form ?? (
        <div>
          <Button onClick={() => setCreating({ fromCart: false })}>{t('new')}</Button>
        </div>
      )}
    </div>
  );
}

/** The lists page body. `initial` is the server's read, passed as the SWR fallback so the page never flashes the empty state. */
export function ListsIndex({ initial }: { initial: SavedList[] }): ReactElement {
  return (
    <SWRConfig value={{ fallback: { [KEY_LISTS]: { lists: initial } } }}>
      <Index />
    </SWRConfig>
  );
}
