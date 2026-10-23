import { normaliseScan } from '@/lib/instore/scan';

/**
 * The scanner dialog as a pure state machine (workstream R, D-045). Two independent parts:
 *  - `camera`: what the camera is doing (`off` before it is asked, `starting`, `on`, `denied` (permission refused), `none` (no
 *    camera or no `getUserMedia`), `error` (any other failure, for example the camera is in use);
 *  - `result`: what the last code led to (`none` while scanning, `looking-up`, `found`, `unknown` (a SKU the shop does not
 *    sell), `invalid` (the text is not a SKU), `lookup-failed` (the server could not answer).
 * Manual entry works in every camera state, so a shopper without a camera can still use the dialog.
 */
export type CameraState = 'off' | 'starting' | 'on' | 'denied' | 'none' | 'error';
export type ResultState = 'none' | 'looking-up' | 'found' | 'unknown' | 'invalid' | 'lookup-failed';

export interface ScanState {
  camera: CameraState;
  result: ResultState;
  /** The SKU being looked up or shown. */
  sku?: string;
  /** The text that was refused as not being a SKU (shown trimmed to 40 characters). */
  rejected?: string;
  /** Last code the camera accepted, for the repeat window. */
  lastSku?: string;
  lastAt?: number;
}

export type ScanEvent =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'camera'; state: Exclude<CameraState, 'off'> }
  | { type: 'decoded'; raw: string; now: number; source: 'camera' | 'manual' }
  | { type: 'lookup'; outcome: 'found' | 'unknown' | 'failed' }
  | { type: 'again' };

export const INITIAL_SCAN_STATE: ScanState = { camera: 'off', result: 'none' };

/** A camera sees one code 30 times a second, and a shopper holds it in view for a while: the same code inside this window is one scan. */
export const REPEAT_WINDOW_MS = 2500;

/** Whether a decoded SKU from the camera should start a lookup now. Manual entry always does (it is deliberate), except mid-lookup. */
export function shouldAccept(state: ScanState, sku: string, now: number, source: 'camera' | 'manual' = 'camera'): boolean {
  if (state.result === 'looking-up') return false;
  if (source === 'manual') return true;
  // A result is on screen: the camera keeps running behind it, but its reads are ignored until the shopper chooses to scan again.
  if (state.result !== 'none') return false;
  return !(state.lastSku === sku && state.lastAt !== undefined && now - state.lastAt < REPEAT_WINDOW_MS);
}

export function scanReducer(state: ScanState, event: ScanEvent): ScanState {
  switch (event.type) {
    case 'open':
      return { ...INITIAL_SCAN_STATE };
    case 'close':
      return { camera: 'off', result: 'none' };
    case 'camera':
      return { ...state, camera: event.state };
    case 'decoded': {
      const parsed = normaliseScan(event.raw);
      if (!parsed.ok) {
        if (event.source === 'camera' && (state.result !== 'none' || parsed.reason === 'empty')) return state;
        if (state.result === 'looking-up') return state;
        return { ...state, result: 'invalid', rejected: event.raw.trim().slice(0, 40), sku: undefined };
      }
      if (!shouldAccept(state, parsed.sku, event.now, event.source)) return state;
      return { ...state, result: 'looking-up', sku: parsed.sku, rejected: undefined, lastSku: parsed.sku, lastAt: event.now };
    }
    case 'lookup': {
      if (state.result !== 'looking-up') return state;
      return { ...state, result: event.outcome === 'failed' ? 'lookup-failed' : event.outcome };
    }
    case 'again':
      // The code just seen stays in the repeat window, so holding the phone still does not bring it straight back.
      return { ...state, result: 'none', sku: undefined, rejected: undefined };
  }
}
