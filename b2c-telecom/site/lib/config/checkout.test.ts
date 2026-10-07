import { CHECKOUT_FLOW, INSTALL_LEAD_DAYS, ORDER_NUMBER_PATTERN, isDemoPayment, sdkLocale } from './checkout';

describe('checkout config', () => {
  it('runs Payment Only (D-061)', () => expect(CHECKOUT_FLOW).toBe('payment'));
  it('lead days: cable 5, others 0', () => expect(INSTALL_LEAD_DAYS).toEqual({ cable: 5, 'fixed-wireless': 0, mobile: 0 }));
  it('order number pattern', () => {
    expect(ORDER_NUMBER_PATTERN.test('MLV-7K3F9QXD')).toBe(true);
    expect(ORDER_NUMBER_PATTERN.test('MLV-7K3F9QXI')).toBe(false);
  });
  it('sdk locale maps de-DE to de', () => {
    expect(sdkLocale('de-DE')).toBe('de');
    expect(sdkLocale('en-US')).toBe('en-US');
  });
  it('demo payment: forced, off, and the no-key default outside production', () => {
    expect(isDemoPayment({ CHECKOUT_DEMO_PAYMENT: 'true', NODE_ENV: 'production' })).toBe(true);
    expect(isDemoPayment({ CHECKOUT_DEMO_PAYMENT: 'false', NODE_ENV: 'development' })).toBe(false);
    expect(isDemoPayment({ NODE_ENV: 'development' })).toBe(true);
    expect(isDemoPayment({ NODE_ENV: 'development', CTP_CHECKOUT_APP_KEY: 'k' })).toBe(false);
    expect(isDemoPayment({ NODE_ENV: 'production' })).toBe(false);
  });
});
