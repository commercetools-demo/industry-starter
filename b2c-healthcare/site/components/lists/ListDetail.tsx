'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Inputs';
import { useListActions } from '@/hooks/use-lists';
import { Link, useRouter } from '@/i18n/routing';
import { MAX_LIST_NAME, type AddAllResult, type ListLineView, type ListView } from '@/lib/lists-types';
import { formatMoney } from '@/lib/utils';

/** What "Add all" did: what went into the cart and, by name, what could not be added and why. Never silent. */
function AddAllNotice({ result }: { result: AddAllResult }) {
  const t = useTranslations('lists.addAllResult');
  return (
    <div role="status" data-add-all-result className="grid gap-1 rounded-md bg-info-50 px-3.5 py-2.5 text-sm text-navy-900">
      {result.added.length > 0 ? <p>{t('added', { names: result.added.join(', ') })}</p> : <p>{t('nothing')}</p>}
      {result.notAdded.length > 0 ? <p data-not-added>{t('notAdded', { names: result.notAdded.map((n) => `${n.name} (${t(`reason.${n.reason}`)})`).join(', ') })}</p> : null}
      {result.added.length > 0 ? (
        <Link href="/cart" className="text-text-link">
          {t('viewCart')}
        </Link>
      ) : null}
    </div>
  );
}

function LineRow({ line, onRemove, busy }: { line: ListLineView; onRemove: () => void; busy: boolean }) {
  const t = useTranslations('lists');
  const locale = useLocale();
  const delta = line.priceDeltaCents;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 last:border-b-0" data-list-line>
      <div className="grid gap-0.5">
        <span className="font-medium text-navy-900">{line.name}</span>
        {line.unavailable ? (
          <Badge variant="no" className="justify-self-start">
            {t('unavailable')}
          </Badge>
        ) : (
          <span className="text-sm text-neutral-600">{t('price', { price: line.price ? formatMoney(line.price.centAmount, line.price.currencyCode, locale) : '' })}</span>
        )}
        {delta !== null && line.price ? (
          <span className="text-sm text-warning-700" data-price-delta>
            {delta > 0 ? t('priceUp', { amount: formatMoney(delta, line.price.currencyCode, locale) }) : t('priceDown', { amount: formatMoney(-delta, line.price.currencyCode, locale) })}
          </span>
        ) : null}
      </div>
      <Button variant="outline" size="sm" busy={busy} aria-label={t('removeLabel', { name: line.name })} onClick={onRemove}>
        {t('remove')}
      </Button>
    </li>
  );
}

function Manage({ list }: { list: ListView }) {
  const t = useTranslations('lists');
  const router = useRouter();
  const { rename, remove } = useListActions();
  const [name, setName] = useState(list.name);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await rename(list.id, name);
      setEditing(false);
      router.refresh();
    } catch {
      setError(t('renameFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    setBusy(true);
    setError(null);
    try {
      await remove(list.id);
      router.push('/account/lists');
      router.refresh();
    } catch {
      setError(t('deleteFailed'));
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 border-t border-border pt-4">
      {editing ? (
        <div className="flex flex-wrap items-end gap-2.5">
          <Input label={t('renameLabel')} value={name} maxLength={MAX_LIST_NAME} onChange={(e) => setName(e.target.value)} fieldClassName="min-w-60" />
          <Button size="sm" busy={busy} onClick={() => void save()}>
            {t('renameSave')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            {t('rename')}
          </Button>
          {confirming ? (
            <>
              <span className="self-center text-sm text-navy-900">{t('deleteConfirm')}</span>
              <Button variant="navy" size="sm" busy={busy} onClick={() => void del()}>
                {t('deleteYes')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
                {t('cancel')}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
              {t('delete')}
            </Button>
          )}
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** `/account/lists/[id]`: the lines with today's prices, "Add all to cart", rename and delete. */
export function ListDetail({ list }: { list: ListView }) {
  const t = useTranslations('lists');
  const router = useRouter();
  const { addAll, removeLine } = useListActions();
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<AddAllResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeFailed, setRemoveFailed] = useState(false);

  async function onAddAll() {
    setAdding(true);
    setFailed(false);
    try {
      setResult(await addAll(list.id));
    } catch {
      setResult(null);
      setFailed(true);
    } finally {
      setAdding(false);
    }
  }

  async function onRemove(lineId: string) {
    setRemoving(lineId);
    setRemoveFailed(false);
    try {
      await removeLine(list.id, lineId);
      router.refresh();
    } catch {
      setRemoveFailed(true);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="grid gap-4" data-list-detail>
      <Link href="/account/lists" className="text-sm text-text-link">
        {t('back')}
      </Link>
      {list.lines.length === 0 ? (
        <EmptyState title={t('noLines')} />
      ) : (
        <Card className="grid gap-3">
          <ul className="m-0 list-none p-0">
            {list.lines.map((line) => (
              <LineRow key={line.id} line={line} busy={removing === line.id} onRemove={() => void onRemove(line.id)} />
            ))}
          </ul>
          <p className="text-sm text-neutral-600">{t('priceNote')}</p>
          <div>
            <Button busy={adding} onClick={() => void onAddAll()}>
              {adding ? t('adding') : t('addAll')}
            </Button>
          </div>
          {result ? <AddAllNotice result={result} /> : null}
          {failed ? (
            <p role="alert" className="text-sm text-danger-700">
              {t('addAllResult.failed')}
            </p>
          ) : null}
          {removeFailed ? (
            <p role="alert" className="text-sm text-danger-700">
              {t('removeFailed')}
            </p>
          ) : null}
        </Card>
      )}
      <Manage list={list} />
    </div>
  );
}
