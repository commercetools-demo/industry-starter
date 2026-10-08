import 'server-only';
import type { Address, LineItem, Order as CtOrder } from '@commercetools/platform-sdk';
import { CANCEL_REASONS } from '@/lib/config/postPurchase';
import { getLocalizedString } from '@/lib/format';
import { addMonths, parseDateOnly } from '@/lib/pricing/dates';
import { parseLabelSnapshot as parseStoredLabelSnapshot } from '@/lib/pricing/label';
import { parseSchedules } from '@/lib/pricing/schedule';
import type {
  AcquisitionMode,
  AddressView,
  DeviceColor,
  Locale,
  LabelSnapshot,
  Money,
  CancellationRecord,
  Order,
  OrderDelivery,
  OrderLine,
  OrderLineAcquisition,
  OrderLineFamily,
  OrderLineKind,
  OrderListItem,
  OrderParcel,
  OrderReturn,
  OrderStatus,
  PriceSchedule,
  PriceSelectionMode,
} from '@/lib/types';

// Orders as the account pages show them. Everything is read from the order itself (D-021): the lines, their custom fields and the
// order's custom fields. Nothing is rebuilt from today's catalog (the snapshot rule).

const OFFER_PREFIX = 'malva-offer-';

/** Order state to the buyer-facing status (first match wins). */
export function statusOf(order: { orderState: string; shipmentState?: string | null }): OrderStatus {
  if (order.orderState === 'Cancelled') return 'cancelled';
  if (order.shipmentState === 'Delivered') return 'delivered';
  if (order.shipmentState === 'Shipped') return 'shipped';
  if (order.orderState === 'Complete') return 'completed';
  if (order.orderState === 'Confirmed') return 'processing';
  if (order.orderState === 'Open') return 'placed';
  return 'unknown';
}

const ADDON_PREFIXES = ['spotify', 'appletv', 'applemusic', 'netflix', 'disneyplus', 'secure', 'device-protect', 'cloud-'];
const EQUIPMENT_PREFIXES = ['router-', 'mesh-', 'modem-', '5g-gateway'];

export interface ClassifyInput {
  productKey?: string | undefined;
  /** Value of the line's variant attribute `offer-kind`, when it is saved to the line item. */
  offerKind?: string | undefined;
  /** Value of the line's variant attribute `offer-family` (`cable`, `fixed-wireless`, `phone`). */
  offerFamily?: string | undefined;
}

/** Classifies a line from its saved attributes, else from the product key prefix; no catalog call. */
export function classifyLine(input: ClassifyInput): { kind: OrderLineKind; family: OrderLineFamily } {
  const key = (input.productKey ?? '').replace(OFFER_PREFIX, '');
  const plan = (): { kind: OrderLineKind; family: OrderLineFamily } => {
    if (input.offerFamily === 'phone' || key.startsWith('phone-')) return { kind: 'phone-plan', family: 'phone' };
    if (input.offerFamily === 'fixed-wireless' || key.startsWith('wireless-')) return { kind: 'internet-plan', family: 'wireless' };
    if (input.offerFamily === 'cable' || key.startsWith('cable-')) return { kind: 'internet-plan', family: 'cable' };
    return { kind: 'other', family: 'other' };
  };
  switch (input.offerKind) {
    case 'base-package':
    case 'bundle':
      return plan();
    case 'addon':
      return { kind: 'addon', family: 'addon' };
    case 'equipment':
      return { kind: 'equipment', family: 'equipment' };
    case 'device':
      return { kind: 'device', family: 'outright' };
    default:
      break;
  }
  if (key.startsWith('phone-nova-')) return { kind: 'device', family: 'outright' };
  if (key.startsWith('cable-') || key.startsWith('wireless-') || key.startsWith('phone-')) return plan();
  if (EQUIPMENT_PREFIXES.some((prefix) => key.startsWith(prefix))) return { kind: 'equipment', family: 'equipment' };
  if (ADDON_PREFIXES.some((prefix) => key.startsWith(prefix))) return { kind: 'addon', family: 'addon' };
  return { kind: 'other', family: 'other' };
}

const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined);

type Fields = Record<string, unknown> | undefined;
const fieldsOf = (custom: { fields?: unknown } | undefined): Fields => custom?.fields as Fields;

/** An attribute saved to the line item: strings and enum `{ key }` values both read as text. */
function attributeText(line: LineItem, name: string): string | undefined {
  const value: unknown = line.variant.attributes?.find((attribute) => attribute.name === name)?.value;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && typeof (value as { key?: unknown }).key === 'string') return (value as { key: string }).key;
  return undefined;
}

/** Parses the stored label snapshot defensively: `null` on any problem, never throws. */
export function parseLabelSnapshot(json: unknown): LabelSnapshot['labels'] | null {
  if (typeof json !== 'string' || json === '') return null;
  const parsed = parseStoredLabelSnapshot(json);
  return parsed.ok ? parsed.value.labels : null;
}

/** Parses the stored price schedules defensively: `[]` on any problem, never throws. */
export function parseSchedule(json: unknown): PriceSchedule[] {
  if (typeof json !== 'string' || json === '') return [];
  const parsed = parseSchedules(json);
  return parsed.ok ? parsed.value : [];
}

const COLORS: Record<string, DeviceColor> = { BLK: 'black', SLV: 'silver', VLT: 'violet' };

/** `MLV-DEV-NOVAPRO-BLK-256` -> memory and colour; null for any other SKU. */
export function deviceVariantOf(sku: string): OrderLine['deviceVariant'] {
  const match = /^MLV-DEV-[A-Z0-9]+-(BLK|SLV|VLT)-(\d+)(?:-BASE)?$/.exec(sku);
  return match ? { memoryGb: match[2] as string, color: COLORS[match[1] as string] as DeviceColor } : null;
}

/** Term in months from the sku suffix (`-24M`, `-12M`, `-M2M`, `-MTH`); 0 = month-to-month; null = unknown. */
export function termFromSku(sku: string): number | null {
  const months = /-(\d+)M$/.exec(sku);
  if (months) return Number(months[1]);
  return /-(M2M|MTH)$/.test(sku) ? 0 : null;
}

const MODES: readonly AcquisitionMode[] = ['outright', 'installments', 'lease'];

function acquisitionOf(fields: Fields, startDate: string): OrderLineAcquisition | null {
  const raw = fields?.acquisitionMode;
  const mode = typeof raw === 'string' ? raw : typeof raw === 'object' && raw !== null ? (raw as { key?: unknown }).key : undefined;
  if (typeof mode !== 'string' || !(MODES as readonly string[]).includes(mode)) return null;
  const term = typeof fields?.acquisitionTermMonths === 'number' ? fields.acquisitionTermMonths : null;
  const stored = text(fields?.acquisitionEndDate);
  let endDate: string | null = stored !== undefined && parseDateOnly(stored) !== null ? stored : null;
  if (endDate === null && term !== null && term > 0 && parseDateOnly(startDate) !== null) {
    // installments: the last of N payments falls N-1 months after the first; a lease is returned after N months
    if (mode === 'installments') endDate = addMonths(startDate, term - 1);
    else if (mode === 'lease') endDate = addMonths(startDate, term);
  }
  return { mode: mode as AcquisitionMode, termMonths: term, endDate };
}

const money = (value: { centAmount: number; currencyCode: string }): Money => ({ centAmount: value.centAmount, currencyCode: value.currencyCode });

function mapLine(line: LineItem, locale: Locale, schedules: PriceSchedule[], startDate: string): OrderLine {
  const fields = fieldsOf(line.custom);
  const sku = line.variant.sku ?? '';
  const classified = classifyLine({ productKey: line.productKey ?? text(fields?.offerKey), offerKind: attributeText(line, 'offer-kind'), offerFamily: attributeText(line, 'offer-family') });
  const acquisition = classified.kind === 'device' ? acquisitionOf(fields, startDate) : null;
  const family: OrderLineFamily = classified.kind === 'device' ? (acquisition?.mode ?? 'outright') : classified.family;
  const schedule = schedules.find((candidate) => candidate.sku === sku);
  const mode = line.recurrenceInfo?.priceSelectionMode;
  const total = money(line.totalPrice);
  const image = line.variant.images?.[0]?.url;
  return {
    id: line.id,
    sku,
    offerKey: text(fields?.offerKey) ?? line.productKey ?? '',
    name: getLocalizedString(line.name as Record<string, string>, locale),
    ...(image ? { imageUrl: image } : {}),
    quantity: line.quantity,
    kind: classified.kind,
    family,
    deviceVariant: classified.kind === 'device' ? deviceVariantOf(sku) : null,
    recurring: line.recurrenceInfo !== undefined,
    priceMode: mode === 'Fixed' || mode === 'Dynamic' ? (mode as PriceSelectionMode) : null,
    termMonths: acquisition?.termMonths ?? schedule?.termMonths ?? termFromSku(sku),
    unitPrice: { centAmount: line.quantity > 0 ? Math.round(total.centAmount / line.quantity) : total.centAmount, currencyCode: total.currencyCode },
    total,
    parentLineId: text(fields?.parentLineItemId) ?? null,
    acquisition,
  };
}

/** What a recurring line costs per month at its standing price: the schedule's standing period, else the line total. */
function standingMonthly(line: OrderLine, schedules: PriceSchedule[]): Money {
  const schedule = schedules.find((candidate) => candidate.sku === line.sku && candidate.status === 'active');
  const period = schedule?.periods.find((candidate) => candidate.kind === 'standing');
  return period ? { centAmount: period.monthlyAmount.centAmount * line.quantity, currencyCode: period.monthlyAmount.currencyCode } : line.total;
}

export function mapAddress(address: Address, defaultId?: string | undefined): AddressView {
  const person = [address.firstName, address.lastName].map((part) => part?.trim() ?? '').filter(Boolean).join(' ');
  const street = address.streetName?.trim() ?? '';
  const number = address.streetNumber?.trim() ?? '';
  const line1 = address.country === 'DE' ? [street, number].filter(Boolean).join(' ') : [number, street].filter(Boolean).join(' ');
  return {
    id: address.id ?? '',
    name: person || (address.company?.trim() ?? ''),
    line1,
    line2: address.additionalStreetInfo?.trim() ?? '',
    city: address.city?.trim() ?? '',
    state: address.state?.trim() ?? '',
    postalCode: address.postalCode?.trim() ?? '',
    country: address.country,
    isDefaultShipping: defaultId !== undefined && address.id === defaultId,
  };
}

// ---- post-purchase (V): shipments, returns, cancellation ------------------------------------------------------------------------

type DeliveryItems = { id: string; quantity: number }[] | undefined;

function mapDeliveryItems(items: DeliveryItems, names: Map<string, string>): { lineItemId: string; name: string; quantity: number }[] {
  return (items ?? []).map((item) => ({ lineItemId: item.id, name: names.get(item.id) ?? item.id, quantity: item.quantity }));
}

/** `shippingInfo.deliveries` with their parcels; the tracking reference is plain text (no carrier integration, D-059). */
export function mapDeliveries(order: CtOrder, names: Map<string, string>): OrderDelivery[] {
  return (order.shippingInfo?.deliveries ?? []).map((delivery) => ({
    id: delivery.id,
    createdAt: delivery.createdAt,
    items: mapDeliveryItems(delivery.items, names),
    parcels: delivery.parcels.map((parcel): OrderParcel => {
      const trackingId = text(parcel.trackingData?.trackingId);
      const carrier = text(parcel.trackingData?.carrier);
      return { id: parcel.id, ...(trackingId ? { trackingId } : {}), ...(carrier ? { carrier } : {}), items: mapDeliveryItems(parcel.items, names) };
    }),
  }));
}

/** `returnInfo`: line item returns only; each item keeps the platform's goods and refund state. */
export function mapReturns(order: CtOrder, names: Map<string, string>): OrderReturn[] {
  return (order.returnInfo ?? []).map((info) => ({
    ...(info.returnDate ? { returnDate: info.returnDate } : {}),
    items: info.items.flatMap((item) => {
      const lineItemId = (item as { lineItemId?: string }).lineItemId;
      if (lineItemId === undefined) return [];
      return [
        {
          id: item.id,
          lineItemId,
          name: names.get(lineItemId) ?? lineItemId,
          quantity: item.quantity,
          ...(item.comment ? { comment: item.comment } : {}),
          shipmentState: String(item.shipmentState),
          paymentState: String(item.paymentState),
        },
      ];
    }),
  }));
}

/** The stored cancellation record; undefined for anything unreadable. */
export function parseCancellation(json: unknown): CancellationRecord | undefined {
  if (typeof json !== 'string' || json === '') return undefined;
  try {
    const value: unknown = JSON.parse(json);
    if (typeof value !== 'object' || value === null) return undefined;
    const { reason, note, cancelledAt } = value as Record<string, unknown>;
    if (typeof reason !== 'string' || !(CANCEL_REASONS as readonly string[]).includes(reason) || typeof cancelledAt !== 'string') return undefined;
    return { reason: reason as CancellationRecord['reason'], ...(typeof note === 'string' && note !== '' ? { note } : {}), cancelledAt, by: 'customer' };
  } catch {
    return undefined;
  }
}

/** Early-termination fee text of each line, from the stored label of that line's SKU (never computed). */
function etfOf(lines: OrderLine[], labels: Order['labels']): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of lines) {
    const etf = labels?.find((entry) => entry.sku === line.sku)?.label.etf;
    if (etf) result[line.id] = etf;
  }
  return result;
}

export function mapOrder(order: CtOrder, locale: Locale): Order {
  const fields = fieldsOf(order.custom);
  const stored = text(fields?.serviceStartDate);
  const serviceStartDate = stored !== undefined && parseDateOnly(stored) !== null ? stored : order.createdAt.slice(0, 10);
  const schedules = parseSchedule(fields?.priceSchedule);
  const lines = order.lineItems.map((line) => mapLine(line, locale, schedules, serviceStartDate));
  const currencyCode = order.totalPrice.currencyCode;
  const monthly = lines.filter((line) => line.recurring).reduce((sum, line) => sum + standingMonthly(line, schedules).centAmount, 0);
  const names = new Map(lines.map((line) => [line.id, line.name]));
  const labels = parseLabelSnapshot(fields?.labelSnapshot);
  const cancellation = parseCancellation(fields?.cancellation);
  return {
    id: order.id,
    orderNumber: order.orderNumber ?? order.id,
    createdAt: order.createdAt,
    status: statusOf({ orderState: order.orderState, shipmentState: order.shipmentState ?? null }),
    orderState: order.orderState,
    shipmentState: order.shipmentState ?? null,
    serviceStartDate,
    lines,
    total: money(order.totalPrice),
    monthly: { centAmount: monthly, currencyCode },
    shippingAddress: order.shippingAddress ? mapAddress(order.shippingAddress) : null,
    schedules,
    labels,
    deliveries: mapDeliveries(order, names),
    returns: mapReturns(order, names),
    ...(cancellation ? { cancellation } : {}),
    etfByLine: etfOf(lines, labels),
  };
}

const LIST_NAMES = 2;

export function mapOrderListItem(order: Order): OrderListItem {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    status: order.status,
    itemNames: order.lines.slice(0, LIST_NAMES).map((line) => line.name),
    more: Math.max(0, order.lines.length - LIST_NAMES),
    total: order.total,
    monthly: order.monthly,
  };
}
