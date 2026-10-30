'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useReducer, useRef, useState } from 'react';
import ManualEntry from '@/components/instore/scan/ManualEntry';
import ScanCamera from '@/components/instore/scan/ScanCamera';
import ScanResult from '@/components/instore/scan/ScanResult';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { useDialog } from '@/components/ui/use-dialog';
import { useScanLookup } from '@/hooks/useScanLookup';
import { INITIAL_SCAN_STATE, scanReducer, type CameraState } from '@/lib/instore/scan-state';
import type { ScannerEngine } from '@/lib/instore/scanner-engine';
import { cn } from '@/lib/cn';
import { marketForLocale } from '@/lib/utils';

/** Development and tests only: feed a decoded string into the dialog exactly as the camera would (a real camera is not always there). */
declare global {
  interface Window {
    __mcfInstoreScan?: (text: string) => void;
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Test seam: replaces the camera and decoder. */
  engine?: ScannerEngine;
}

/**
 * The scanner dialog (workstream R): a full-screen sheet with the camera on top and the answer below. The camera is only
 * started while the dialog is open, and released when it closes. Every way a scan can go wrong has its own message and a way
 * forward, and the code can always be typed instead (D-045). The sheet below the camera shows, in turn: the hint and the manual
 * entry, the lookup, the product with Add to bag, or "unknown", "not one of our codes" and "could not look that up".
 */
export default function ScanDialog({ open, onClose, engine }: Props) {
  const t = useTranslations('instore.scan');
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialog({ open, onClose, ref: panelRef });

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-hidden="true"
      inert={!open}
      data-open={open}
      tabIndex={-1}
      className={cn('fixed inset-0 z-90 flex-col bg-ink text-surface', open ? 'flex' : 'hidden')}
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+12px)]">
        <h2 id={titleId} className="m-0 font-display text-[20px] font-bold">
          {t('title')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="transition-state flex h-12 w-12 items-center justify-center rounded-pill border-0 bg-surface/15 text-surface hover:bg-surface/25"
        >
          <Icon name="x" size={24} />
        </button>
      </div>
      {open ? <ScanSession onClose={onClose} {...(engine ? { engine } : {})} /> : null}
    </div>
  );
}

function ScanSession({ onClose, engine }: { onClose: () => void; engine?: ScannerEngine }) {
  const t = useTranslations('instore.scan');
  const country = marketForLocale(useLocale()).country;
  const [state, dispatch] = useReducer(scanReducer, INITIAL_SCAN_STATE);
  const [attempt, setAttempt] = useState(0);
  const [lookupTry, setLookupTry] = useState(0);

  const lookingUp = state.result === 'looking-up' || state.result === 'found';
  const { product, status } = useScanLookup(lookingUp ? (state.sku ?? null) : null, country, lookupTry);

  // The lookup answer moves the state machine; it ignores an answer that arrives when no lookup is running.
  useEffect(() => {
    if (state.result !== 'looking-up') return;
    if (status === 'found') dispatch({ type: 'lookup', outcome: 'found' });
    else if (status === 'unknown') dispatch({ type: 'lookup', outcome: 'unknown' });
    else if (status === 'failed') dispatch({ type: 'lookup', outcome: 'failed' });
  }, [state.result, status]);

  const onText = useCallback((raw: string) => dispatch({ type: 'decoded', raw, now: Date.now(), source: 'camera' }), []);
  const onCamera = useCallback((camera: Exclude<CameraState, 'off'>) => dispatch({ type: 'camera', state: camera }), []);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    window.__mcfInstoreScan = onText;
    return () => {
      delete window.__mcfInstoreScan;
    };
  }, [onText]);

  const again = () => dispatch({ type: 'again' });
  const cameraProblem = state.camera === 'denied' || state.camera === 'none' || state.camera === 'error';

  return (
    <>
      <div className="relative min-h-[28vh] flex-1 overflow-hidden bg-ink">
        <ScanCamera engine={engine} attempt={attempt} onCamera={onCamera} onText={onText} label={t('cameraLabel')} />
        {(state.camera === 'on' || state.camera === 'starting') && state.result === 'none' ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="aspect-[5/3] w-[78%] max-w-[420px] rounded-card border-2 border-surface/90" />
          </div>
        ) : null}
        {state.camera === 'starting' && state.result === 'none' ? (
          <p role="status" className="absolute inset-x-0 bottom-4 m-0 text-center text-[14px] font-medium text-surface">
            {t('starting')}
          </p>
        ) : null}
        {cameraProblem ? (
          <div role="alert" data-testid="camera-problem" data-camera={state.camera} className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink px-6 text-center">
            <Icon name="camera" size={44} className="text-surface/80" />
            <p className="m-0 font-display text-[19px] font-bold">{t(`${state.camera as 'denied' | 'none' | 'error'}.title`)}</p>
            <p className="m-0 max-w-[34ch] text-[15px] text-surface/90">{t(`${state.camera as 'denied' | 'none' | 'error'}.body`)}</p>
            {state.camera !== 'none' ? (
              <Button variant="ghost" size="lg" className="min-h-12 border-surface/60! text-surface hover:border-surface!" onClick={() => setAttempt((n) => n + 1)}>
                {t('retryCamera')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-t-panel bg-canvas px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-5 text-ink" data-testid="scan-sheet" data-result={state.result}>
        {state.result === 'none' ? (
          <div className="flex flex-col gap-4">
            {state.camera === 'on' ? <p className="m-0 text-center text-[15px] font-medium text-ink-2">{t('hint')}</p> : null}
            <ManualEntry busy={false} onSubmit={(sku) => dispatch({ type: 'decoded', raw: sku, now: Date.now(), source: 'manual' })} />
          </div>
        ) : null}

        {state.result === 'looking-up' ? (
          <p role="status" className="m-0 py-6 text-center text-[16px] font-medium text-ink-2" data-testid="scan-looking-up">
            {t('lookingUp', { sku: state.sku ?? '' })}
          </p>
        ) : null}

        {state.result === 'found' && product ? <ScanResult key={product.sku} product={product} onScanAnother={again} onClose={onClose} /> : null}

        {state.result === 'unknown' ? (
          <Message testId="scan-unknown" title={t('unknown.title')} body={t('unknown.body', { sku: state.sku ?? '' })} action={t('again')} onAction={again} />
        ) : null}
        {state.result === 'invalid' ? (
          <Message testId="scan-invalid" title={t('invalid.title')} body={t('invalid.body')} action={t('again')} onAction={again} />
        ) : null}
        {state.result === 'lookup-failed' ? (
          <Message
            testId="scan-failed"
            title={t('failed.title')}
            body={t('failed.body')}
            action={t('retry')}
            onAction={() => {
              if (state.sku) dispatch({ type: 'decoded', raw: state.sku, now: Date.now(), source: 'manual' });
              setLookupTry((n) => n + 1);
            }}
            secondary={t('again')}
            onSecondary={again}
          />
        ) : null}
      </div>
    </>
  );
}

function Message({
  testId, title, body, action, onAction, secondary, onSecondary,
}: {
  testId: string;
  title: string;
  body: string;
  action: string;
  onAction: () => void;
  secondary?: string;
  onSecondary?: () => void;
}) {
  return (
    <div role="alert" data-testid={testId} className="flex flex-col gap-3">
      <p className="m-0 font-display text-[19px] font-bold text-ink">{title}</p>
      <p className="m-0 text-[15px] text-ink-2">{body}</p>
      <Button size="lg" variant="accent" className="min-h-14" onClick={onAction}>
        {action}
      </Button>
      {secondary && onSecondary ? (
        <Button size="lg" variant="ghost" className="min-h-14" onClick={onSecondary}>
          {secondary}
        </Button>
      ) : null}
    </div>
  );
}
