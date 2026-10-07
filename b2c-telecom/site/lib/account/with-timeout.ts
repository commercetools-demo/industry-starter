import { PANEL_TIMEOUT_MS } from '@/lib/config/account';

export { PANEL_TIMEOUT_MS };

export class PanelTimeoutError extends Error {
  constructor(readonly ms: number) {
    super(`The panel did not answer within ${ms} ms`);
    this.name = 'PanelTimeoutError';
  }
}

/** Rejects with `PanelTimeoutError` when `promise` has not settled after `ms`; the timer never outlives the promise. */
export function withTimeout<T>(promise: Promise<T>, ms: number = PANEL_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new PanelTimeoutError(ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
