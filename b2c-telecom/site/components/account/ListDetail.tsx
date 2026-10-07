'use client';

import { useState, type ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { SWRConfig } from 'swr';
import { ConfirmDialog } from '@/components/bundle/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { FOCUS_RING } from '@/components/ui/focus';
import { Tag } from '@/components/ui/Tag';
import { useToast } from '@/components/ui/Toast';
import { useList, useListMutations } from '@/hooks/useLists';
import { Link, useRouter } from '@/i18n/routing';
import { keyList } from '@/lib/cache-keys';
import { cx } from '@/lib/cx';
import { formatMoneyExact } from '@/lib/format';
import type { BundleMoveResult, Locale, Money, SavedListDetail, SavedListLine } from '@/lib/types';
import { ListNameForm } from './ListNameForm';

const ACTION = cx('min-h-9 bg-transparent p-0 font-display text-sm font-semibold text-text-link underline underline-offset-4 disabled:opacity-50', FOCUS_RING);

function Row({ line, onRemove, busy }: { line: SavedListLine; onRemove: () => void; busy: boolean }): ReactElement {
  const t = useTranslations('account.lists');
  const locale = useLocale() as Locale;
  const money = (value: Money): string => formatMoneyExact(value, locale);
  const price = (value: Money): string => (line.recurring ? t('perMonth', { amount: money(value) }) : money(value));
  const delta = line.delta;
  const sign = delta.deltaCents > 0 ? '+' : '−';
  return (
    <li className={cx('flex flex-wrap items-center gap-x-7 gap-y-3 rounded-xl border border-border bg-surface p-7', !line.available && 'bg-neutral-50 text-text-muted')} data-line-id={line.lineId}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-display text-lg font-bold">{line.name}</span>
        {line.term ? <span className="text-md">{t(`term.${line.term}`)}</span> : line.variantLabel ? <span className="text-md">{line.variantLabel}</span> : null}
        {line.quantity > 1 ? <span className="text-sm">{t('quantity', { count: line.quantity })}</span> : null}
      </div>
      <div className="flex flex-col items-end gap-2">
        {line.available && line.current ? (
          <>
            <span className="sr-only">{t('priceNow')}</span>
            <span className="font-display text-lg font-semibold">{price(line.current)}</span>
            {delta.status === 'up' || delta.status === 'down' ? (
              <Tag tone={delta.status === 'up' ? 'pink' : 'brand'} className="normal-case">
                {line.saved ? t('priceChanged', { was: money(line.saved), now: money(line.current), delta: `${sign}${money({ centAmount: Math.abs(delta.deltaCents), currencyCode: line.current.currencyCode })}` }) : null}
              </Tag>
            ) : null}
          </>
        ) : (
          <span className="text-md">{t('unavailableLine')}</span>
        )}
      </div>
      <button type="button" className={ACTION} onClick={onRemove} disabled={busy}>
        {t('removeLine')}
        <span className="sr-only"> {line.name}</span>
      </button>
    </li>
  );
}

function Detail({ listId }: { listId: string }): ReactElement | null {
  const t = useTranslations('account.lists');
  const root = useTranslations();
  const toast = useToast();
  const router = useRouter();
  const { list } = useList(listId);
  const { rename, remove, removeLine, moveToBundle } = useListMutations();
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [moved, setMoved] = useState<BundleMoveResult | null>(null);

  if (!list) return null;
  const availableLines = list.lines.filter((line) => line.available).length;

  async function run(action: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    try {
      await action();
    } catch {
      toast.show({ message: t('errors.generic'), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function addAll(): Promise<void> {
    setMoving(true);
    try {
      setMoved(await moveToBundle(listId));
    } catch {
      toast.show({ message: t('errors.generic'), tone: 'error' });
    } finally {
      setMoving(false);
    }
  }

  const reasonText = (reason: BundleMoveResult['skipped'][number]['reason']): string => {
    if (reason.code === 'NO_LONGER_AVAILABLE') return t('unavailableLine');
    if (reason.messageKey && root.has(reason.messageKey)) return root(reason.messageKey, reason.params ?? {});
    return reason.message;
  };

  return (
    <div className="flex flex-col gap-7">
      <h1 className="m-0 font-display text-4xl font-bold tracking-ui">{list.name}</h1>
      <div className="flex flex-wrap items-center gap-5">
        {renaming ? (
          <ListNameForm
            initial={list.name}
            submitLabel={t('name.save')}
            onSubmit={async (name) => {
              await rename(listId, name);
              setRenaming(false);
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <>
            <button type="button" className={ACTION} onClick={() => setRenaming(true)}>
              {t('name.rename')}
            </button>
            <button type="button" className={ACTION} onClick={() => setConfirmDelete(true)}>
              {t('delete.action')}
            </button>
          </>
        )}
      </div>

      {moved ? (
        <section role="status" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-7">
          <p className="m-0 font-display text-lg font-semibold">{moved.added.length > 0 ? t('moveResult.added', { count: moved.added.length }) : t('moveResult.none')}</p>
          {moved.skipped.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-md">
              {moved.skipped.map((skip) => (
                <li key={skip.lineId}>{t('moveResult.skippedLine', { name: skip.name, reason: reasonText(skip.reason) })}</li>
              ))}
            </ul>
          ) : null}
          {moved.added.length > 0 ? (
            <Link href="/bundle" className={cx('font-display text-sm font-semibold text-text-link underline underline-offset-4', FOCUS_RING)}>
              {t('moveResult.view')}
            </Link>
          ) : null}
        </section>
      ) : null}

      {list.lines.length === 0 ? (
        <p className="m-0 text-md">{t('linesEmpty')}</p>
      ) : (
        <>
          <ul className="m-0 flex list-none flex-col gap-5 p-0">
            {list.lines.map((line) => (
              <Row key={line.lineId} line={line} busy={busy} onRemove={() => void run(() => removeLine(listId, line.lineId))} />
            ))}
          </ul>
          <div>
            <Button onClick={() => void addAll()} loading={moving} disabled={availableLines === 0 || moving}>
              {moving ? t('adding') : t('addAll')}
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={t('delete.title')}
        confirmLabel={t('delete.confirm')}
        cancelLabel={t('delete.cancel')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          void run(async () => {
            await remove(listId);
            router.push('/account/lists');
          });
        }}
      >
        <p className="m-0">{t('delete.body')}</p>
      </ConfirmDialog>
    </div>
  );
}

/** One saved list. `initial` is the server's read (prices already resolved now); the list itself is never changed by "Add all". */
export function ListDetail({ initial }: { initial: SavedListDetail }): ReactElement | null {
  return (
    <SWRConfig value={{ fallback: { [keyList(initial.id)]: { list: initial } }, revalidateOnMount: false }}>
      <Detail listId={initial.id} />
    </SWRConfig>
  );
}
