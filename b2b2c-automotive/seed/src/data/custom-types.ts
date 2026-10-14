// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { FieldDefinition, TypeDraft } from '@commercetools/platform-sdk';
import { CONTRACT_TYPE_KEYS as T, ls } from './base';

const str = (name: string, de: string, en: string, required = false): FieldDefinition => ({ name, label: ls(de, en), required, type: { name: 'String' }, inputHint: 'SingleLine' });
const text = (name: string, de: string, en: string): FieldDefinition => ({ name, label: ls(de, en), required: false, type: { name: 'String' }, inputHint: 'MultiLine' });
const num = (name: string, de: string, en: string): FieldDefinition => ({ name, label: ls(de, en), required: false, type: { name: 'Number' }, inputHint: 'SingleLine' });
const bool = (name: string, de: string, en: string): FieldDefinition => ({ name, label: ls(de, en), required: false, type: { name: 'Boolean' }, inputHint: 'SingleLine' });
const when = (name: string, de: string, en: string): FieldDefinition => ({ name, label: ls(de, en), required: false, type: { name: 'DateTime' }, inputHint: 'SingleLine' });
const enumOf = (name: string, de: string, en: string, keys: string[]): FieldDefinition => ({
  name, label: ls(de, en), required: false, type: { name: 'Enum', values: keys.map((key) => ({ key, label: key })) }, inputHint: 'SingleLine',
});

export const SALES_CHANNELS = ['web', 'instagram', 'facebook', 'whatsapp', 'tiktok', 'in-store'];
export const PICKUP_MODES = ['same-day', 'next-day', 'ship-to-store'];
/** Return item statuses (workstream W): Open = requested, in-transit, received, inspected; Closed = refunded, rejected. */
export const RETURN_STATUSES = ['requested', 'in-transit', 'received', 'inspected', 'refunded', 'rejected'];
export const LINE_FIT = ['fits', 'not-fit', 'unknown'];

/**
 * Custom types the specs need. A resource has ONE custom type, so each resource kind gets exactly one type that carries
 * every field the workstreams read or write. Key names are the contract the apps use (`CONTRACT_TYPE_KEYS` in base.ts);
 * `plans/SEED-PLAN.md` section 3.6 maps the names the plans used before (`malva-store`, `customer-garage`, `portal-*`).
 * Nothing here belongs to wholesale buying (no PO number, payment terms, approval or credit fields) or to an email outbox.
 */
export const typeDrafts: TypeDraft[] = [
  {
    key: T.storeSettings, name: ls('Malva Shop-Einstellungen', 'Malva store settings'), resourceTypeIds: ['store'],
    fieldDefinitions: [
      str('ownerBusinessUnitKey', 'Eigentümer-Einheit', 'Owner business unit', true), str('currency', 'Währung', 'Currency'), str('taxLabel', 'Steuerbezeichnung', 'Tax label'),
      num('freeShippingThresholdCent', 'Versandkostenfrei ab (Cent)', 'Free shipping threshold (cents)'), str('defaultCountry', 'Standardland', 'Default country'),
      num('shipDaysMin', 'Lieferzeit min. (Tage)', 'Ship days min'), num('shipDaysMax', 'Lieferzeit max. (Tage)', 'Ship days max'), str('timezone', 'Zeitzone', 'Time zone'),
      str('helpUrl', 'Hilfe-URL', 'Help URL'), str('trackUrl', 'Sendungsverfolgung-URL', 'Tracking URL'),
      num('returnWindowDays', 'Rückgabefrist (Tage)', 'Return window (days)'),
      str('addressLine', 'Straße und Nummer', 'Address line'), str('postalCode', 'Postleitzahl', 'Postal code'), str('city', 'Ort', 'City'), str('countryCode', 'Land (ISO)', 'Country code'),
      num('latitude', 'Breitengrad', 'Latitude'), num('longitude', 'Längengrad', 'Longitude'),
      str('logoUrl', 'Logo-URL', 'Logo URL'), str('faviconUrl', 'Favicon-URL', 'Favicon URL'),
    ],
  },
  {
    key: T.branchInfo, name: ls('Malva Filiale', 'Malva branch'), resourceTypeIds: ['channel'],
    fieldDefinitions: [
      text('openingHours', 'Öffnungszeiten (JSON)', 'Opening hours (JSON)'), str('timezone', 'Zeitzone', 'Time zone'), str('phone', 'Telefon', 'Phone'),
      enumOf('pickupMode', 'Abholoption', 'Pickup mode', PICKUP_MODES), str('storeKey', 'Shop (Key)', 'Store key'),
    ],
  },
  {
    // The resource type id 'order' covers both carts and orders (there is no 'cart' id), so cart fields are copied to the order.
    key: T.checkout, name: ls('Malva Checkout-Felder', 'Malva checkout fields'), resourceTypeIds: ['order'],
    fieldDefinitions: [
      str('mobile', 'Handynummer (Abholhinweis)', 'Mobile number (pickup alerts)'), str('pickupBranchKey', 'Abholfiliale (Key)', 'Pickup branch key'), str('fitVehicleLabel', 'Fahrzeug (Anzeige)', 'Vehicle label'),
      bool('isTest', 'Testbestellung', 'Test order'), when('deliveredAt', 'Zugestellt/abgeholt am', 'Delivered or collected at'),
      enumOf('salesChannel', 'Vertriebskanal', 'Sales channel', SALES_CHANNELS), str('costCentre', 'Kostenstelle', 'Cost centre'), str('placedOnBehalfBy', 'Im Auftrag von (Mitarbeiter)', 'Placed on behalf by (seller user)'),
    ],
  },
  {
    key: T.line, name: ls('Malva Positions-Felder', 'Malva line item fields'), resourceTypeIds: ['line-item'],
    fieldDefinitions: [
      str('vehicleFitmentKey', 'Fahrzeug (Fitment-Key)', 'Vehicle fitment key'), text('vehicle', 'Fahrzeug (JSON)', 'Vehicle (JSON)'), enumOf('fit', 'Passform', 'Fit', LINE_FIT),
      str('parentLineItemId', 'Übergeordnete Position', 'Parent line item'),
    ],
  },
  {
    // Garage (Q-J04, at most 5 vehicles, JSON { vehicles, activeId }), contact and consent. Consent is recorded, never used to send email (Q-P01).
    key: T.customer, name: ls('Malva Kunden-Felder', 'Malva customer fields'), resourceTypeIds: ['customer'],
    fieldDefinitions: [
      text('garage', 'Garage (JSON)', 'Garage (JSON)'), str('preferredBranchKey', 'Bevorzugte Filiale', 'Preferred branch key'), str('mobile', 'Handynummer', 'Mobile number'), str('jobTitle', 'Position', 'Job title'),
      bool('isDemo', 'Demo-Konto', 'Demo account'), bool('marketingConsent', 'Marketing-Einwilligung', 'Marketing consent'), when('marketingConsentAt', 'Einwilligung am', 'Consent at'), when('lastActiveAt', 'Zuletzt aktiv', 'Last active'),
    ],
  },
  {
    key: T.returnItem, name: ls('Malva Retourenposition', 'Malva return item'), resourceTypeIds: ['order-return-item'],
    fieldDefinitions: [
      str('returnNumber', 'Retourennummer', 'Return number'), enumOf('status', 'Status', 'Status', RETURN_STATUSES), str('reason', 'Grund', 'Reason'),
      num('refundCents', 'Erstattung (Cent)', 'Refund (cents)'), str('rejectReason', 'Ablehnungsgrund', 'Reject reason'),
      // Set by the portal when a refund is requested; a Refund transaction only counts when created after it (V-12).
      when('refundRequestedAt', 'Erstattung angefordert am', 'Refund requested at'),
    ],
  },
  {
    key: 'mau-business-unit-fields', name: ls('Malva Einheiten-Felder', 'Malva business unit fields'), resourceTypeIds: ['business-unit'],
    fieldDefinitions: [
      enumOf('kind', 'Art', 'Kind', ['malva-global', 'malva-dach', 'reseller', 'branch']), str('storeKey', 'Shop (Key)', 'Store key'), str('channelKey', 'Filial-Kanal (Key)', 'Branch channel key'),
      // Company profile (design-company-and-account); shown only when present. No credit limit or payment terms (wholesale, Q-V01).
      str('legalName', 'Firmenname (rechtlich)', 'Legal name'), str('taxId', 'Steuernummer / USt-IdNr.', 'Tax ID'), str('accountNumber', 'Kontonummer', 'Account number'),
    ],
  },
  {
    key: 'mau-cart-discount-fields', name: ls('Malva Rabatt-Felder', 'Malva discount fields'), resourceTypeIds: ['cart-discount'],
    fieldDefinitions: [enumOf('fundedBy', 'Finanziert durch', 'Funded by', ['malva', 'reseller']), str('storeKey', 'Shop (Key)', 'Store key')],
  },
];
