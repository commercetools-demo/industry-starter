import type { Cart as CtCart } from '@commercetools/platform-sdk';
import { mapCart, type CartMapOptions } from '@/lib/mappers/cart';
import { mapMoney } from '@/lib/mappers';
import type { AddressInput, CheckoutCart } from '@/lib/types';

/** The cart's address as the form shows it; null until every required part is there (country-only is not an address). */
export function mapCartAddress(address: CtCart['shippingAddress']): AddressInput | null {
  if (!address?.streetName || !address.city || !address.state || !address.postalCode || !address.firstName || !address.lastName || !address.phone) return null;
  return {
    firstName: address.firstName,
    lastName: address.lastName,
    street: address.streetName,
    street2: address.additionalStreetInfo ?? '',
    city: address.city,
    state: address.state,
    zip: address.postalCode,
    phone: address.phone,
  };
}

/**
 * Platform cart -> checkout cart. The payable total is `taxedPrice.totalGross` once the platform has taxed the
 * cart (tax-exclusive US prices: `totalPrice` is the net amount), else `totalPrice`; tax is `taxedPrice.totalTax`.
 * Nothing is computed here. The shipping method key needs `shippingInfo.shippingMethod` expanded.
 */
export function mapCheckoutCart(cart: CtCart, options: CartMapOptions = {}): CheckoutCart {
  const base = mapCart(cart, options);
  const taxed = cart.taxedPrice;
  const method = cart.shippingInfo?.shippingMethod?.obj;
  return {
    ...base,
    total: taxed ? mapMoney(taxed.totalGross) : base.total,
    shippingAddress: mapCartAddress(cart.shippingAddress),
    shippingMethodKey: method?.key ?? null,
    tax: taxed ? mapMoney(taxed.totalTax ?? { centAmount: 0, currencyCode: taxed.totalGross.currencyCode, fractionDigits: taxed.totalGross.fractionDigits }) : null,
  };
}
