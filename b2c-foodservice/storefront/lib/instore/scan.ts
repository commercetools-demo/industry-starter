/**
 * Barcode text to SKU (workstream R, D-045). Pure; used by the camera path, the manual entry and the lookup route.
 * The barcodes on the products are the SKUs, so a scan is accepted only when it looks like one (`SKU_PATTERN`, the same
 * pattern the inventory and cart routes use). Anything else, a competitor's EAN with a space, a URL, a long payload, never
 * leaves the browser.
 */

/** Same pattern as `lib/ct/inventory.ts` (not imported: that module is server-only and this one runs in the browser). */
export const SKU_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export type ScanParse = { ok: true; sku: string } | { ok: false; reason: 'empty' | 'invalid' };

// Control characters (scanner guns and some decoders add CR, LF, TAB or GS) and the zero-width marks some QR generators add.
const NOISE = /[\u0000-\u001f\u007f​-‍﻿]/g;
/** AIM symbology identifier: `]` + one letter + one modifier, for example `]C1` (Code 128) or `]E0` (EAN-13). */
const AIM_PREFIX = /^\][A-Za-z][0-9A-Za-z]/;

export function normaliseScan(raw: unknown): ScanParse {
  if (typeof raw !== 'string') return { ok: false, reason: 'empty' };
  let text = raw.replace(NOISE, '').trim();
  if (AIM_PREFIX.test(text)) text = text.slice(3).trim();
  if (text === '') return { ok: false, reason: 'empty' };
  return SKU_PATTERN.test(text) ? { ok: true, sku: text } : { ok: false, reason: 'invalid' };
}
