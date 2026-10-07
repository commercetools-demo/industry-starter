import 'server-only';
import type { Address as CtAddress, Cart as CtCart, LineItem } from '@commercetools/platform-sdk';
import type { Address, Cart, CartLine, CartSlot } from '../types';
import { getLocalizedString } from '../utils';
import { mapVariant, type MapContext } from './product';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

export function mapAddress(a: CtAddress): Address {
  return {
    firstName: a.firstName,
    lastName: a.lastName,
    streetName: a.streetName,
    additionalStreetInfo: a.additionalStreetInfo,
    postalCode: a.postalCode,
    city: a.city,
    country: a.country,
    phone: a.phone,
    email: a.email,
  };
}

export function mapLine(line: LineItem, locale: string): CartLine {
  const variant = mapVariant(line.variant, locale);
  const discounted = line.price.discounted?.value;
  const info = line.recurrenceInfo;
  const policy = info?.recurrencePolicy;
  const fields: unknown = line.custom?.fields;
  const preference = isRecord(fields) ? fields.substitutionPreference : undefined;
  return {
    id: line.id,
    productId: line.productId,
    sku: variant.sku,
    name: getLocalizedString(line.name, locale),
    slug: getLocalizedString(line.productSlug, locale),
    image: variant.images[0],
    quantity: line.quantity,
    unitPrice: {
      centAmount: line.price.value.centAmount,
      currencyCode: line.price.value.currencyCode,
      ...(discounted ? { discounted: { centAmount: discounted.centAmount, currencyCode: discounted.currencyCode } } : {}),
    },
    total: { centAmount: line.totalPrice.centAmount, currencyCode: line.totalPrice.currencyCode },
    increment: variant.increment,
    approximateWeight: variant.approximateWeight,
    substitutionPreference: preference === 'allow-similar' ? 'allow-similar' : 'none',
    ...(info && policy
      ? {
          recurrence: {
            // `obj.key` when the policy reference is expanded (see `lib/ct/cart.ts`), else the id.
            policyKey: policy.obj?.key ?? policy.id,
            priceSelectionMode: info.priceSelectionMode === 'Fixed' ? ('Fixed' as const) : ('Dynamic' as const),
          },
        }
      : {}),
    availableQuantity: line.variant.availability?.availableQuantity,
    inStock: variant.availability.isOnStock,
  };
}

export function mapSlot(custom: CtCart['custom']): CartSlot | undefined {
  const fields: unknown = custom?.fields;
  if (!isRecord(fields)) return undefined;
  const id = str(fields.slotId);
  const start = str(fields.slotStart);
  const end = str(fields.slotEnd);
  if (!id || !start || !end) return undefined;
  const holdExpires = str(fields.slotHoldExpires);
  return { id, start, end, ...(holdExpires ? { holdExpires } : {}) };
}

/** Pure mapping from an SDK cart to the app `Cart`. Totals are the server's values; nothing is recomputed except the line subtotal. */
export function mapCart(cart: CtCart, ctx: MapContext): Cart {
  const lines = cart.lineItems.map((l) => mapLine(l, ctx.locale));
  const currencyCode = cart.totalPrice.currencyCode;
  const shippingInfo = cart.shippingInfo;
  const tax = cart.taxedPrice?.totalTax;
  const slot = mapSlot(cart.custom);
  return {
    id: cart.id,
    version: cart.version,
    currencyCode,
    lines,
    itemCount: lines.length,
    subtotal: { centAmount: lines.reduce((sum, l) => sum + l.total.centAmount, 0), currencyCode },
    ...(shippingInfo
      ? {
          shipping: {
            name: shippingInfo.shippingMethodName,
            price: { centAmount: shippingInfo.price.centAmount, currencyCode: shippingInfo.price.currencyCode },
            free: shippingInfo.price.centAmount === 0,
          },
        }
      : {}),
    ...(tax ? { tax: { centAmount: tax.centAmount, currencyCode: tax.currencyCode } } : {}),
    total: { centAmount: cart.totalPrice.centAmount, currencyCode },
    isProvisional: lines.some((l) => l.approximateWeight),
    ...(cart.shippingAddress ? { shippingAddress: mapAddress(cart.shippingAddress) } : {}),
    ...(slot ? { slot } : {}),
  };
}
