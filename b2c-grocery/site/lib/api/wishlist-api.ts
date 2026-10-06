import 'server-only';
import type { ShoppingList } from '@commercetools/platform-sdk';
import type { NextResponse } from 'next/server';
import { productIdsOf } from '@/lib/ct/shopping-lists';
import { getSession } from '@/lib/session';
import { privateJson } from './private-json';

export const wishlistError = (error: string, status: number): NextResponse => privateJson({ error }, { status });

/** The signed-in customer id, or `null` (the account layout guards pages only, so every data route checks itself). */
export async function customerIdOf(): Promise<string | null> {
  return (await getSession()).customerId ?? null;
}

export const wishlistJson = (list: ShoppingList): NextResponse => privateJson({ productIds: productIdsOf(list) });

/** commercetools rejects an unknown product id with 400; other failures are ours. */
export function wishlistFailure(e: unknown): NextResponse {
  const status = typeof e === 'object' && e !== null ? (e as { statusCode?: unknown }).statusCode : undefined;
  console.error('Wishlist request failed', e instanceof Error ? e.message : e);
  return status === 400 ? wishlistError('INVALID_PRODUCT', 400) : wishlistError('WISHLIST_ERROR', 500);
}
