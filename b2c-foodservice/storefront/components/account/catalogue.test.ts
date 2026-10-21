import { describe, expect, it } from 'vitest';
import enCA from '@/messages/en-CA.json';
import enUS from '@/messages/en-US.json';

function flatten(value: unknown, prefix = ''): [string, unknown][] {
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
  }
  return [[prefix, value]];
}

const us = flatten((enUS as Record<string, unknown>).account, 'account');
const ca = flatten((enCA as Record<string, unknown>).account, 'account');

describe('account catalogue', () => {
  it('Catalogues have the same keys', () => {
    expect(us.length).toBeGreaterThan(150);
    expect(ca.map(([k]) => k).sort()).toEqual(us.map(([k]) => k).sort());
  });

  it('no message is empty and en-CA carries real text', () => {
    for (const [key, value] of [...us, ...ca]) {
      expect(typeof value, key).toBe('string');
      expect((value as string).trim().length, key).toBeGreaterThan(0);
    }
  });

  it('en-CA equals en-US for the account (no spelling differences are needed)', () => {
    expect(Object.fromEntries(ca)).toEqual(Object.fromEntries(us));
  });

  it('Loyalty not offered: no message mentions points, loyalty or membership', () => {
    for (const [key, value] of us) expect(String(value), key).not.toMatch(/loyalty|points|membership|member perks/i);
  });

  it('there is no email or password reset promise (D-032)', () => {
    for (const [key, value] of us) expect(String(value), key).not.toMatch(/we.ll email|emailed to you|reset your password|check your inbox/i);
  });

  it('carries every key of the plan (section 3.10)', () => {
    const keys = new Set(us.map(([k]) => k));
    for (const k of [
      'account.eyebrow', 'account.greeting', 'account.status.open', 'account.status.openNone', 'account.status.ready', 'account.status.unavailable',
      'account.tabs.label', 'account.tabs.signOut', 'account.panel.unavailable', 'account.panel.retry', 'account.panel.loading',
      'account.orders.title', 'account.orders.empty', 'account.orders.emptyCta', 'account.orders.filter.inProgress', 'account.orders.pill.collected',
      'account.orders.readyBlock', 'account.orders.buyAgain', 'account.orders.directions', 'account.orders.notFound', 'account.orders.reorder.reason.price_missing',
      'account.orders.detail.noTracking', 'account.orders.return.start', 'account.orders.return.shipment.Unusable', 'account.orders.return.payment.NonRefundable',
      'account.collection.title', 'account.collection.tile.fastText', 'account.saved.empty', 'account.saved.addAll', 'account.addresses.deleteDefaultNone',
      'account.addresses.verify.keepMine', 'account.payments.hostedOnly', 'account.profile.emailHelp', 'account.password.wrongCurrent',
      'account.settings.title', 'account.delete.retained', 'account.subscriptions.stub',
    ]) {
      expect(keys.has(k), k).toBe(true);
    }
  });
});
