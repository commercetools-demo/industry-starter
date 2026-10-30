import { vi } from 'vitest';
import { CameraError, type ScannerEngine } from '@/lib/instore/scanner-engine';
import type { ScanProduct } from '@/lib/types';

/** Test data and a fake camera for the In-store companion (workstream R). */
export const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD' });

export function scanProduct(over: Partial<ScanProduct> = {}): ScanProduct {
  return {
    sku: 'MCF-POD-EMBER-50', productId: 'p-1', slug: 'ember-ristretto', name: 'Ember Ristretto', imageUrl: 'https://img.example.com/ember.jpg',
    variant: 'Intensity 12 · 50 capsules', price: { amount: usd(2595) }, availability: { state: 'in', quantity: 40 }, inventoryFailed: false,
    minQuantity: 1, maxQuantity: 40, href: '/p/ember-ristretto/MCF-POD-EMBER-50', ...over,
  };
}

/**
 * A fake scanner engine. `result`: 'on' starts the camera, or the kind of CameraError to fail with. `scan(text)` feeds a decoded
 * string exactly as a camera would; `stop` is called when the dialog releases the camera.
 */
export function fakeEngine(result: 'on' | 'denied' | 'none' | 'error' = 'on') {
  const state = { onText: undefined as undefined | ((t: string) => void), starts: 0, stops: 0 };
  const engine: ScannerEngine = {
    async start(_video, onText) {
      state.starts += 1;
      state.onText = onText;
      if (result !== 'on') throw new CameraError(result);
      return { decoder: 'native' as const, stop: () => void (state.stops += 1) };
    },
  };
  return { engine, state, scan: (text: string) => state.onText?.(text) };
}

export const notFoundBody = { error: { code: 'not_found', message: 'x' } };
export const spy = () => vi.fn();
