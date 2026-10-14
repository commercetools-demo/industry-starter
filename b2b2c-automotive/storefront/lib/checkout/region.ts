// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Pure: the Checkout region (`eu-central-1.aws`) from the Composable Commerce API URL, so no separate CT_REGION variable exists (O D3).

/** The region for the Content-Security-Policy: only when a Checkout Application is configured and the API URL names a commercetools region, else `undefined`. */
export function checkoutRegionFromEnv(env: Record<string, string | undefined>): string | undefined {
  if (!env.CTP_CHECKOUT_APP_KEY?.trim() || !env.CTP_API_URL) return undefined;
  try {
    return deriveRegion(env.CTP_API_URL);
  } catch {
    return undefined;
  }
}

/** `https://api.us-central1.gcp.commercetools.com` gives `us-central1.gcp`. Throws a clear error for anything else; no value is echoed. */
export function deriveRegion(apiUrl: string): string {
  let host: string;
  try {
    host = new URL(apiUrl).hostname;
  } catch {
    throw new Error('CTP_API_URL is not a valid URL, cannot derive the Checkout region');
  }
  const match = /^api\.([a-z0-9-]+\.(?:gcp|aws))\.commercetools\.com$/.exec(host);
  if (!match) throw new Error('CTP_API_URL is not a commercetools API host, cannot derive the Checkout region');
  return match[1];
}
