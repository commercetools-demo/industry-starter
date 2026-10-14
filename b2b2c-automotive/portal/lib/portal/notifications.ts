/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Notification dismissals (R-14, Q-R04): stored per customer in localStorage, so no server write is needed. Client safe.
import type { PortalNotification } from './types';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const dismissedKey = (customerId: string) => `portal-dismissed-${customerId}`;

export function readDismissed(storage: StorageLike | null, customerId: string): string[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(dismissedKey(customerId)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function dismissNotification(storage: StorageLike | null, customerId: string, id: string): string[] {
  const next = [...new Set([...readDismissed(storage, customerId), id])];
  try {
    storage?.setItem(dismissedKey(customerId), JSON.stringify(next));
  } catch {
    // Storage may be full or blocked; the dismissal then lasts for this page view only.
  }
  return next;
}

export const unreadItems = (items: PortalNotification[], dismissed: string[]) => items.filter((n) => !dismissed.includes(n.id));
