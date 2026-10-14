import { beforeEach, describe, expect, it } from 'vitest';
import { dismissNotification, dismissedKey, readDismissed, unreadItems } from './notifications';
import type { PortalNotification } from './types';

const item = (id: string): PortalNotification => ({ id, kind: 'order-shipped', values: { order: id }, href: '/' });
const three = [item('a'), item('b'), item('c')];

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

let storage = memoryStorage();
beforeEach(() => {
  storage = memoryStorage();
});

describe('notifications', () => {
  it('dismiss drops the count from 3 to 2 and persists per customer', () => {
    expect(unreadItems(three, readDismissed(storage, 'cust-1'))).toHaveLength(3);
    dismissNotification(storage, 'cust-1', 'b');
    expect(unreadItems(three, readDismissed(storage, 'cust-1')).map((n) => n.id)).toEqual(['a', 'c']);
    // persisted under the per-customer key, and another customer is unaffected
    expect(storage.data.has(dismissedKey('cust-1'))).toBe(true);
    expect(unreadItems(three, readDismissed(storage, 'cust-2'))).toHaveLength(3);
  });

  it('the key is portal-dismissed- plus the customer id', () => {
    expect(dismissedKey('cust-1')).toBe('portal-dismissed-cust-1');
  });

  it('corrupt or unavailable storage reads as nothing dismissed', () => {
    storage.setItem(dismissedKey('x'), '{not json');
    expect(readDismissed(storage, 'x')).toEqual([]);
    expect(readDismissed(null, 'x')).toEqual([]);
  });

  it('dismissing twice stores the id once', () => {
    dismissNotification(storage, 'c', 'a');
    dismissNotification(storage, 'c', 'a');
    expect(readDismissed(storage, 'c')).toEqual(['a']);
  });
});
