// Request bodies of the device cart routes. Pure; every failure is a plain message the route turns into 400 INVALID_INPUT.
import { MAX_DEVICE_QUANTITY } from '@/lib/config/devices';
import type { AcquisitionMode } from '@/lib/types';

const MODES: readonly AcquisitionMode[] = ['outright', 'installments', 'lease'];
const isText = (value: unknown): value is string => typeof value === 'string' && value !== '' && value.length <= 200;

export type ParsedMode = { ok: true; mode: AcquisitionMode; termMonths: number } | { ok: false; message: string };

/** `mode` and `termMonths` of a body. Outright takes no term (0 or absent); installments and lease take a whole number of months. */
export function parseMode(body: Record<string, unknown>): ParsedMode {
  const { mode, termMonths } = body;
  const found = MODES.find((candidate) => candidate === mode);
  if (!found) return { ok: false, message: 'mode must be outright, installments or lease.' };
  if (found === 'outright') return { ok: true, mode: found, termMonths: 0 };
  if (typeof termMonths !== 'number' || !Number.isInteger(termMonths) || termMonths < 1) return { ok: false, message: 'termMonths must be a whole number of months.' };
  return { ok: true, mode: found, termMonths };
}

export type ParsedAdd = { ok: true; offerKey: string; sku: string; quantity: number; mode: AcquisitionMode; termMonths: number } | { ok: false; message: string };

export function parseAddBody(body: Record<string, unknown>): ParsedAdd {
  const { offerKey, sku, quantity } = body;
  if (!isText(offerKey) || !isText(sku)) return { ok: false, message: 'offerKey and sku are required.' };
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_DEVICE_QUANTITY) {
    return { ok: false, message: `quantity must be a whole number from 1 to ${MAX_DEVICE_QUANTITY}.` };
  }
  const mode = parseMode(body);
  return mode.ok ? { ok: true, offerKey, sku, quantity, mode: mode.mode, termMonths: mode.termMonths } : mode;
}
