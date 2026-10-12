// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeThemeSaves } from './save-observer';

const base = '/api/contentools/service';
const original = window.fetch;
afterEach(() => {
  window.fetch = original;
});

function setup(status = 200) {
  const inner = vi.fn(async () => new Response('{}', { status }));
  window.fetch = inner as unknown as typeof window.fetch;
  const onSaved = vi.fn();
  const dispose = observeThemeSaves({ proxyBase: base, storeKey: 'store-a', onSaved });
  return { inner, onSaved, dispose };
}

describe('observeThemeSaves', () => {
  it('successful PUT on the theme URL resolves, fetch restored on unmount, other URLs ignored', async () => {
    const { inner, onSaved, dispose } = setup();
    const wrapped = window.fetch;
    expect(wrapped).not.toBe(inner);
    await window.fetch(`${base}/store-a/configuration/theme`, { method: 'PUT', body: '{}' });
    expect(onSaved).toHaveBeenCalledTimes(1);
    await window.fetch(`${base}/store-a/configuration/theme`, { method: 'POST', body: '{}' });
    expect(onSaved).toHaveBeenCalledTimes(2);

    await window.fetch(`${base}/store-a/configuration/theme`);
    await window.fetch(`${base}/store-a/puck-pages`, { method: 'PUT' });
    await window.fetch(`${base}/store-b/configuration/theme`, { method: 'PUT' });
    await window.fetch('https://example.test/x', { method: 'PUT' });
    expect(onSaved).toHaveBeenCalledTimes(2);

    dispose();
    expect(window.fetch).toBe(inner);
  });

  it('a failed save is not reported', async () => {
    const { onSaved } = setup(500);
    await window.fetch(`${base}/store-a/configuration/theme`, { method: 'PUT' });
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('accepts a Request object and absolute URLs', async () => {
    const { onSaved } = setup();
    await window.fetch(new Request(`${window.location.origin}${base}/store-a/configuration/theme`, { method: 'PUT', body: '{}' }));
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
});
