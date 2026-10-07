'use client';

import { useId, useState, type ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FOCUS_RING } from '@/components/ui/focus';
import { useToast } from '@/components/ui/Toast';
import { AccountApiError } from '@/hooks/accountRequest';
import { useListMutations, useLists } from '@/hooks/useLists';
import { useSession } from '@/hooks/useSession';
import { Link, usePathname } from '@/i18n/routing';
import { MAX_LINES_PER_LIST, MAX_LISTS } from '@/lib/config/lists';
import { cx } from '@/lib/cx';
import { ListNameForm } from './ListNameForm';

const LINK = cx('inline-flex min-h-9 items-center bg-transparent p-0 font-display text-sm font-semibold text-text-link underline underline-offset-4', FOCUS_RING);

/** Where "Save for later" sends a visitor who is not signed in: sign in, then come back to this page (R's `returnTo`). */
export function useSignInHref(): string {
  const locale = useLocale();
  const pathname = usePathname();
  return `/login?returnTo=${encodeURIComponent(`/${locale}${pathname}`)}`;
}

type SaveToListButtonProps = { offerKey: string; variantId?: number };

/**
 * "Save to list" on an offer card. Signed in: a small panel with the customer's lists (choosing one saves the offer at its current
 * price) and "New list…". Anonymous: "Save for later" links to sign-in; the save is NOT completed automatically after sign-in.
 * Nothing is shown until the session is known (no flash of the wrong control).
 */
export function SaveToListButton({ offerKey, variantId }: SaveToListButtonProps): ReactElement | null {
  const t = useTranslations('account.lists');
  const toast = useToast();
  const { session } = useSession();
  const signInHref = useSignInHref();
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const groupId = useId();
  const signedIn = session?.kind === 'customer';
  const { lists } = useLists({ enabled: signedIn && open });
  const { addOffer, create } = useListMutations();

  if (!session) return null;
  if (!signedIn) {
    return (
      <Link href={signInHref} className={LINK}>
        {t('saveForLater')}
      </Link>
    );
  }

  async function save(listId: string, listName: string): Promise<void> {
    setBusy(true);
    try {
      await addOffer(listId, offerKey, variantId);
      toast.show({ message: t('saved', { list: listName }) });
      setOpen(false);
    } catch (error) {
      toast.show({ message: error instanceof AccountApiError && error.code === 'LIST_FULL' ? t('full', { max: MAX_LINES_PER_LIST }) : t('errors.generic'), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function createAndSave(name: string): Promise<void> {
    let created;
    try {
      created = await create(name);
    } catch (error) {
      throw new Error(error instanceof AccountApiError && error.code === 'LIST_LIMIT' ? t('limit', { max: MAX_LISTS }) : t('errors.generic'));
    }
    await save(created.id, created.name);
    setNaming(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <button type="button" className={LINK} aria-expanded={open} aria-controls={groupId} onClick={() => setOpen((value) => !value)}>
        {t('saveTo')}
      </button>
      {open ? (
        <fieldset id={groupId} disabled={busy} className="m-0 flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
          <legend className="px-2 font-display text-sm font-semibold">{t('chooseList')}</legend>
          {lists.map((list) => (
            <label key={list.id} className="flex min-h-9 items-center gap-3 text-md">
              <input type="radio" name={`${groupId}-list`} className="size-5 shrink-0 accent-action" onChange={() => void save(list.id, list.name)} />
              {list.name}
            </label>
          ))}
          {naming ? (
            <ListNameForm submitLabel={t('name.create')} onSubmit={createAndSave} onCancel={() => setNaming(false)} />
          ) : (
            <button type="button" className={LINK} onClick={() => setNaming(true)}>
              {t('newListOption')}
            </button>
          )}
        </fieldset>
      ) : null}
    </div>
  );
}
