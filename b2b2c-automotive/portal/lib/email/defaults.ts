/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Default texts of the three e-mail templates (W-04). Stored per store on first edit; never sent (Q-P01). Pure.
// The texts live in default-templates.json so that scripts/ensure-w.mjs writes the same defaults.
import defaults from './default-templates.json';

export const TEMPLATE_KEYS = ['order-confirmation', 'shipment-update', 'win-back'] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];
export type Locale = 'de-DE' | 'en-US';
export type Localized = Record<Locale, string>;

export interface EmailTemplate {
  subject: Localized;
  body: Localized;
  enabled: boolean;
}

export const DEFAULT_TEMPLATES: Record<TemplateKey, EmailTemplate> = defaults;

export const isTemplateKey = (value: string): value is TemplateKey => (TEMPLATE_KEYS as readonly string[]).includes(value);

/** The order events and the template each one uses (`null`: no template exists for the event). */
export const TRANSACTIONAL_EVENTS = [
  { id: 'order-placed', template: 'order-confirmation' },
  { id: 'order-shipped', template: 'shipment-update' },
  { id: 'order-delivered', template: null },
] as const satisfies readonly { id: string; template: TemplateKey | null }[];
