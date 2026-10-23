import type { Handler } from '@commercetools/checkout-browser-sdk';

/**
 * The only module that imports the Checkout Browser SDK (an ESLint exception names this file). The SDK is loaded when the pay
 * stage mounts, never on the Review stage or any other page. Components receive plain callbacks and never see the SDK's message
 * objects: only the event `code` is passed on, never a payload (it can carry card or personal data).
 */
export interface HostedStart {
  projectKey: string;
  region: string;
  sessionId: string;
  /** SDK locale (see `sdkLocale`). */
  locale: string;
  /** Number and currency formatting locale (the page locale). */
  currencyLocale: string;
  styles?: Record<string, string>;
  onInfo: (code: string) => void;
  onError: (code: string) => void;
}

/** The SDK supports `en` and `de` (and `en-US`): every English market uses `en` (probe S12 records what `en-CA` does live). */
export function sdkLocale(pageLocale: string): string {
  return pageLocale.toLowerCase().startsWith('en') ? 'en' : pageLocale;
}

/**
 * Starts the complete hosted Checkout (`checkoutFlow`). The hosted success and error pages are skipped (D-039): the host reacts to
 * `checkout_completed` and to errors itself. Returns a function that closes the widget.
 */
export async function startHostedCheckout(c: HostedStart): Promise<() => void> {
  const sdk = await import('@commercetools/checkout-browser-sdk');
  const handler = (fn: (code: string) => void): Handler => (message) => {
    fn(message.code);
  };
  sdk.checkoutFlow({
    projectKey: c.projectKey,
    region: c.region,
    sessionId: c.sessionId,
    locale: c.locale,
    currencyLocale: c.currencyLocale,
    styles: c.styles,
    skipPaymentSuccessPage: true,
    skipPaymentErrorPage: true,
    onInfo: handler(c.onInfo),
    onError: handler(c.onError),
    logInfo: false,
    logWarn: false,
    logError: false,
  });
  return () => sdk.close();
}
