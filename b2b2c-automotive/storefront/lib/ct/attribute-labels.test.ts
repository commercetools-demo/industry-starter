// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ apiRoot: { productTypes: () => ({ withKey: (a: unknown) => ({ get: () => ({ execute: () => get(a) }) }) }) }, projectKey: 'p' }));

const load = async () => (await import('./attribute-labels')).getEnumLabels;
const type = {
  attributes: [
    { name: 'brand', type: { name: 'enum', values: [{ key: 'vektra', label: 'Vektra' }, { key: 'malva-select', label: 'Malva Select' }] } },
    { name: 'position', type: { name: 'lenum', values: [{ key: 'front', label: { 'de-DE': 'Vorderachse', 'en-US': 'Front' } }] } },
    { name: 'warranty-months', type: { name: 'number' } },
  ],
};

beforeEach(() => {
  vi.resetModules();
  get.mockReset();
});

describe('Filter labels: lib/ct/attribute-labels', () => {
  it('returns enum and lenum labels per attribute and locale', async () => {
    get.mockResolvedValue({ body: type });
    const labels = await (await load())('de-DE');
    expect(labels.brand).toEqual({ vektra: 'Vektra', 'malva-select': 'Malva Select' });
    expect(labels.position).toEqual({ front: 'Vorderachse' });
    expect(labels['warranty-months']).toBeUndefined();
    expect(get).toHaveBeenCalledWith({ key: 'mau-pt-part' });
  });

  it('reads the product type once an hour for every locale', async () => {
    get.mockResolvedValue({ body: type });
    const fn = await load();
    await fn('de-DE');
    expect((await fn('en-US')).position).toEqual({ front: 'Front' });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('an outage yields no labels instead of an error', async () => {
    get.mockRejectedValue({ statusCode: 500 });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await (await load())('en-US')).toEqual({});
    error.mockRestore();
  });
});
