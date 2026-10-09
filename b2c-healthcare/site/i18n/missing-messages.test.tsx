import { IntlError, IntlErrorCode, NextIntlClientProvider, useTranslations } from 'next-intl';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createMissingMessageHandlers, mergeMessages } from './missing-messages';

const missing = new IntlError(IntlErrorCode.MISSING_MESSAGE, 'Could not resolve `common.nope` in messages for locale `en-US`.');

function Probe() {
  const t = useTranslations('common');
  return <p data-testid="out">{t('nope')}</p>;
}

function renderProbe(isDevelopment: boolean, active: Record<string, unknown>, fallback: Record<string, unknown>) {
  const log = vi.fn();
  const handlers = createMissingMessageHandlers(isDevelopment, fallback, log);
  render(
    <NextIntlClientProvider
      locale="en-US"
      messages={active as never}
      onError={handlers.onError}
      getMessageFallback={handlers.getMessageFallback}
    >
      <Probe />
    </NextIntlClientProvider>,
  );
  return log;
}

describe('storefront-locale-routing: Messages and document language', () => {
  it('Missing key: in development the error is logged with the key and the key is rendered', () => {
    const log = renderProbe(true, { common: {} }, { common: { nope: 'Default text' } });
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[0])).toContain('common.nope');
    expect(screen.getByTestId('out')).toHaveTextContent('common.nope');
  });

  it('Missing key: in production the default-locale text is shown, not the key, and nothing is logged', () => {
    const log = renderProbe(false, { common: {} }, { common: { nope: 'Default text' } });
    expect(screen.getByTestId('out')).toHaveTextContent('Default text');
    expect(screen.getByTestId('out')).not.toHaveTextContent('common.nope');
    expect(log).not.toHaveBeenCalled();
  });

  it('Missing key: in production a key absent everywhere renders empty rather than the key', () => {
    renderProbe(false, { common: {} }, { common: {} });
    expect(screen.getByTestId('out')).toBeEmptyDOMElement();
  });

  it('production still logs errors other than a missing message', () => {
    const log = vi.fn();
    const handlers = createMissingMessageHandlers(false, {}, log);
    handlers.onError(missing);
    expect(log).not.toHaveBeenCalled();
    handlers.onError(new IntlError(IntlErrorCode.FORMATTING_ERROR, 'bad format'));
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('mergeMessages puts default-locale text under the active catalog', () => {
    expect(mergeMessages({ a: { x: '1', y: '2' }, b: 'B' }, { a: { y: 'two' } })).toEqual({ a: { x: '1', y: 'two' }, b: 'B' });
  });
});
