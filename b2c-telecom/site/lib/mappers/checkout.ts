import 'server-only';
import type { Address, Cart as CtCart } from '@commercetools/platform-sdk';
import { isPhysicalLine } from '@/lib/checkout/physical';
import type { Cart, CheckoutAddress, CheckoutState, Money } from '@/lib/types';

// The checkout's view of a commercetools cart: contact, addresses, delivery method, shipping price and tax. Everything is read from the
// cart the platform returned (never computed): the summary is a projection of the last cart response.

const money = (value: { centAmount: number; currencyCode: string }): Money => ({ centAmount: value.centAmount, currencyCode: value.currencyCode });
const text = (value: string | undefined): string => (typeof value === 'string' ? value.trim() : '');

export function mapCheckoutAddress(address: Address | undefined): CheckoutAddress | null {
  if (!address) return null;
  const country = address.country === 'DE' ? 'DE' : address.country === 'US' ? 'US' : null;
  if (!country) return null;
  const additional = text(address.additionalStreetInfo);
  const state = text(address.state);
  const phone = text(address.phone) || text(address.mobile);
  return {
    firstName: text(address.firstName),
    lastName: text(address.lastName),
    streetName: [text(address.streetNumber), text(address.streetName)].filter(Boolean).join(' '),
    ...(additional ? { additionalStreetInfo: additional } : {}),
    city: text(address.city),
    ...(state ? { state } : {}),
    postalCode: text(address.postalCode),
    country,
    ...(phone ? { phone } : {}),
  };
}

/** True once the cart carries a street: the market's ZIP-only address written by "My bundle" is not a service address yet. */
const isFullAddress = (address: CheckoutAddress | null): address is CheckoutAddress => address !== null && address.streetName !== '' && address.firstName !== '';

export function mapCheckoutState(ct: CtCart, cart: Cart, signedIn: boolean): CheckoutState {
  const service = mapCheckoutAddress(ct.shippingAddress);
  const billing = mapCheckoutAddress(ct.billingAddress);
  const info = ct.shippingInfo;
  const taxPortion = ct.taxedPrice?.totalTax;
  const phone = text(ct.shippingAddress?.phone) || text(ct.shippingAddress?.mobile);
  return {
    cart,
    signedIn,
    email: text(ct.customerEmail) || null,
    phone: phone || null,
    serviceAddress: isFullAddress(service) ? service : null,
    billingAddress: isFullAddress(billing) ? billing : null,
    needsDelivery: cart.lines.some(isPhysicalLine),
    delivery: info?.shippingMethod ? { id: info.shippingMethod.id, name: info.shippingMethodName, price: money(info.price) } : null,
    shipping: info ? money(info.price) : null,
    tax: taxPortion ? money(taxPortion) : null,
    needsCustomer: ct.lineItems.some((line) => line.recurrenceInfo !== undefined),
  };
}
