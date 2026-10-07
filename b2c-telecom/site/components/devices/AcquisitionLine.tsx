'use client';

import { useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { FOCUS_RING } from '@/components/ui/focus';
import { useDeviceActions } from '@/hooks/useDeviceActions';
import { cx } from '@/lib/cx';
import { lineQuote } from '@/lib/devices/acquisition';
import type { AcquisitionChoice } from '@/lib/devices/choice';
import type { CartLine } from '@/lib/types';
import { AcquisitionModePicker } from './AcquisitionModePicker';
import { AcquisitionSummary } from './AcquisitionSummary';
import { useDeviceErrorText } from './useDeviceError';

type AcquisitionLineProps = {
  /** A device line of the bundle that carries its `acquisition`. */
  line: CartLine;
  busy?: boolean;
  onRemove: (lineId: string) => void;
};

const KNOWN_COLORS = new Set(['black', 'silver', 'violet']);

/**
 * A device line of the bundle (undrawn: Junior design choice, D-068): name, color and memory, how it is paid with what is due today,
 * monthly and in total, the end-of-term obligation, and "Change how you pay" with the same picker as the card. A change is one
 * server update that reprices the line; the amounts shown are the server's line total, never computed here.
 */
export function AcquisitionLine({ line, busy = false, onRemove }: AcquisitionLineProps): ReactElement | null {
  const t = useTranslations('devices');
  const tb = useTranslations('bundle');
  const { changeAcquisition } = useDeviceActions();
  const errorText = useDeviceErrorText(line.name);
  const acquisition = line.acquisition;
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState<AcquisitionChoice | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!acquisition) return null;

  const prices = line.device?.prices;
  const current: AcquisitionChoice = { mode: acquisition.mode, termMonths: acquisition.termMonths };
  const picked = choice ?? current;
  const quote = lineQuote(line.total, acquisition, new Date());
  const stock = line.stock;
  const color = line.device ? (KNOWN_COLORS.has(line.device.color) ? t(`colorName.${line.device.color as 'black'}`) : line.device.color) : null;
  const variant = line.device ? `${color} · ${t('memoryValue', { gb: line.device.memoryGb })}` : null;

  const apply = async (): Promise<void> => {
    setWorking(true);
    setError(null);
    try {
      await changeAcquisition(line.id, picked);
      setEditing(false);
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setWorking(false);
    }
  };

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-border bg-surface px-6 py-4">
      <div className="flex flex-wrap items-center gap-5">
        <div aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-md bg-pink-900 font-display text-xl font-bold text-text-on-pink">
          {line.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-40 flex-1">
          <div className="font-display text-lg font-bold">{line.name}</div>
          {variant ? <div className="text-sm text-text-muted">{variant}</div> : null}
          <div className="text-sm text-text-muted">
            {t(`mode.${acquisition.mode}`)}
            {acquisition.mode === 'outright' ? '' : ` · ${t('line.term', { months: acquisition.termMonths })}`}
            {line.quantity > 1 ? ` · ${t('line.quantity', { count: line.quantity })}` : ''}
          </div>
          {stock && !stock.inStock ? (
            <Tag tone="danger" className="mt-2">
              {stock.available && stock.available > 0 ? tb('stock.few', { count: stock.available }) : tb('stock.out')}
            </Tag>
          ) : null}
        </div>
        {prices ? (
          <button
            type="button"
            aria-expanded={editing}
            disabled={busy || working}
            onClick={() => {
              setEditing((open) => !open);
              setChoice(null);
              setError(null);
            }}
            className={cx('rounded-pill bg-transparent p-0 font-display text-sm font-semibold text-text underline underline-offset-4', FOCUS_RING)}
          >
            {t('change')}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy || working}
          onClick={() => onRemove(line.id)}
          aria-label={tb('line.removeAria', { name: line.name })}
          className={cx('rounded-pill bg-transparent p-0 font-display text-sm font-semibold text-text underline underline-offset-4', FOCUS_RING)}
        >
          {tb('line.remove')}
        </button>
      </div>
      <AcquisitionSummary quote={quote} estimate={acquisition.endDate === undefined} />
      {editing && prices ? (
        <div className="flex flex-col gap-5 border-t border-border pt-4">
          <AcquisitionModePicker deviceName={line.name} prices={prices} choice={picked} onChange={setChoice} />
          <div className="flex flex-wrap gap-3">
            <Button size="sm" loading={working} disabled={picked.mode === current.mode && picked.termMonths === current.termMonths} onClick={() => void apply()}>
              {t('changeApply')}
            </Button>
            <Button size="sm" variant="secondary" disabled={working} onClick={() => setEditing(false)}>
              {t('changeCancel')}
            </Button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="m-0 text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}
