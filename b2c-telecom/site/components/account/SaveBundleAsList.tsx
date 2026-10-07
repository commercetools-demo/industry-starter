'use client';

import { useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { FOCUS_RING } from '@/components/ui/focus';
import { useToast } from '@/components/ui/Toast';
import { AccountApiError } from '@/hooks/accountRequest';
import { useListMutations } from '@/hooks/useLists';
import { useSession } from '@/hooks/useSession';
import { Link } from '@/i18n/routing';
import { MAX_LISTS } from '@/lib/config/lists';
import { cx } from '@/lib/cx';
import { ListNameForm } from './ListNameForm';
import { useSignInHref } from './SaveToListButton';

const LINK = cx('inline-flex min-h-9 items-center self-center bg-transparent p-0 font-display text-sm font-semibold text-text-link underline underline-offset-4', FOCUS_RING);

/** "Save bundle as list" in the bundle's order summary (T's slot). Anonymous visitors are sent to sign-in and come back to My bundle. */
export function SaveBundleAsList(): ReactElement | null {
  const t = useTranslations('account.lists');
  const toast = useToast();
  const { session } = useSession();
  const signInHref = useSignInHref();
  const { create } = useListMutations();
  const [naming, setNaming] = useState(false);

  if (!session) return null;
  if (session.kind !== 'customer') {
    return (
      <Link href={signInHref} className={LINK}>
        {t('saveForLater')}
      </Link>
    );
  }
  if (!naming) {
    return (
      <button type="button" className={LINK} onClick={() => setNaming(true)}>
        {t('saveBundle')}
      </button>
    );
  }

  async function submit(name: string): Promise<void> {
    try {
      const list = await create(name, true);
      toast.show({ message: t('saved', { list: list.name }), actionLabel: t('title'), href: `/account/lists/${list.id}` });
      setNaming(false);
    } catch (error) {
      throw new Error(error instanceof AccountApiError && error.code === 'LIST_LIMIT' ? t('limit', { max: MAX_LISTS }) : t('errors.generic'));
    }
  }

  return <ListNameForm submitLabel={t('name.create')} onSubmit={submit} onCancel={() => setNaming(false)} />;
}
