// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Detects a successful theme save made by the embedded ThemeManager: while the Theme tab is mounted, `window.fetch` is wrapped
// and a PUT or POST to `<proxy base>/<store>/configuration/theme` that answers 2xx calls `onSaved` (workstream U-06, decision 13).
// The original `fetch` is restored on dispose.

export interface SaveObserverOptions {
  proxyBase: string;
  storeKey: string;
  onSaved: () => void;
}

export function observeThemeSaves({ proxyBase, storeKey, onSaved }: SaveObserverOptions): () => void {
  const original = window.fetch;
  const themePath = `${proxyBase}/${storeKey}/configuration/theme`;
  const wrapped: typeof window.fetch = async (input, init) => {
    const response = await original.call(window, input, init);
    try {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
      const path = new URL(raw, window.location.origin).pathname;
      if ((method === 'PUT' || method === 'POST') && path === themePath && response.ok) onSaved();
    } catch {
      // an unparsable URL is never ours
    }
    return response;
  };
  window.fetch = wrapped;
  return () => {
    if (window.fetch === wrapped) window.fetch = original;
  };
}
