/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWFake, type WFake } from '@/lib/portal/w-fixture-root';

let fake: WFake;
vi.mock('./catalog-root', () => ({ catalogRoot: async () => fake.root }));
vi.mock('./w-root', () => ({ wRoot: async () => fake.root }));

import { DEFAULT_TEMPLATES } from '@/lib/email/defaults';
import { getTemplate, listEvents, listTemplates, previewTemplate, saveTemplate } from './email-templates';

const NORTH = 'mau-reseller-north';
const SOUTH = 'mau-reseller-south';
const text = (s: string) => ({ 'de-DE': s, 'en-US': s });

beforeEach(() => {
  fake = createWFake();
});

describe('email templates', () => {
  it('shows the default text for a template that was never saved', async () => {
    const t = await getTemplate(NORTH, 'order-confirmation');
    expect(t.stored).toBe(false);
    expect(t.subject['en-US']).toBe(DEFAULT_TEMPLATES['order-confirmation'].subject['en-US']);
    expect((await listTemplates(NORTH)).map((x) => x.key)).toEqual(['order-confirmation', 'shipment-update', 'win-back']);
  });

  it('unknown variable refused: names the first offender and writes nothing', async () => {
    fake.resetCalls();
    await expect(saveTemplate(NORTH, 'order-confirmation', { subject: text('Hi {{foo}}'), body: text('Order {{order_number}}'), enabled: true })).rejects.toMatchObject({ status: 400, code: 'UNKNOWN_VARIABLE', details: { variable: 'foo' }, message: 'Unknown variable foo' });
    await expect(saveTemplate(NORTH, 'order-confirmation', { subject: text('Hi'), body: { 'de-DE': 'ok', 'en-US': '{{ bar }} {{foo}}' }, enabled: true })).rejects.toMatchObject({ details: { variable: 'bar' } });
    await expect(saveTemplate(NORTH, 'order-confirmation', { subject: text('Hi {{order_number'), body: text('x'), enabled: true })).rejects.toMatchObject({ code: 'UNBALANCED_BRACES' });
    expect(fake.writes()).toHaveLength(0);
  });

  it('saves per store and per template key; another store keeps its own', async () => {
    await saveTemplate(NORTH, 'win-back', { subject: text('TST-W Hallo {{customer_name}}'), body: text('Body'), enabled: true });
    expect((await getTemplate(NORTH, 'win-back')).subject['en-US']).toBe('TST-W Hallo {{customer_name}}');
    expect((await getTemplate(SOUTH, 'win-back')).stored).toBe(false);
    expect(fake.state.objects.get(`malva-email-templates/${NORTH}--win-back`)?.value).toMatchObject({ storeKey: NORTH, enabled: true });
    await expect(getTemplate(NORTH, 'nope')).rejects.toMatchObject({ status: 404 });
  });

  it('preview uses the sample order and escapes values', () => {
    const p = previewTemplate({ subject: text('Your order {{order_number}} is confirmed'), body: text('Hi {{customer_name}}\n<b>x</b>') });
    expect(p.subject['en-US']).toBe('Your order MO-482913 is confirmed');
    expect(p.html['en-US']).toBe('Hi Alex Muster<br>&lt;b&gt;x&lt;/b&gt;');
  });

  it('transactional event states: a saved enabled template is "stored-not-sent", none is "not-set-up", there is no live state', async () => {
    expect((await listEvents(NORTH)).map((e) => e.state)).toEqual(['not-set-up', 'not-set-up', 'not-set-up']);
    await saveTemplate(NORTH, 'order-confirmation', { subject: text('A {{order_number}}'), body: text('B'), enabled: true });
    await saveTemplate(NORTH, 'shipment-update', { subject: text('A'), body: text('B'), enabled: false });
    const events = await listEvents(NORTH);
    expect(events).toEqual([
      { id: 'order-placed', template: 'order-confirmation', state: 'stored-not-sent' },
      { id: 'order-shipped', template: 'shipment-update', state: 'not-set-up' },
      { id: 'order-delivered', template: null, state: 'not-set-up' },
    ]);
    expect(JSON.stringify(events)).not.toMatch(/\blive\b/i);
  });

  it('no module reads a template to send it: no call leaves the module besides object reads and writes', async () => {
    await saveTemplate(NORTH, 'win-back', { subject: text('A'), body: text('B'), enabled: true });
    expect(fake.calls.every((c) => c.op.startsWith('object.'))).toBe(true);
  });
});
