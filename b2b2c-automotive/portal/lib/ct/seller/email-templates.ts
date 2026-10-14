/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// E-mail templates of a store (W-04, W-06). Templates are STORED and PREVIEWED only; nothing is ever sent and no provider exists
// (Q-P01, D8). Container `malva-email-templates`, key `<storeKey>--<templateKey>`, value `{ storeKey, subject, body, enabled }`.
import 'server-only';
import type { TemplateView, EventState, EventView, Preview } from '@/lib/w-types';
import { CatalogError } from '@/lib/catalog/errors';
import { DEFAULT_TEMPLATES, isTemplateKey, TEMPLATE_KEYS, TRANSACTIONAL_EVENTS, type EmailTemplate, type Locale, type TemplateKey } from '@/lib/email/defaults';
import { renderTemplate, renderText, SAMPLE_VARIABLES } from '@/lib/email/render';
import { templateProblem } from '@/lib/email/variables';
import { CONTAINERS, readObject, storeObjectKey, upsertObject } from './w-objects';

export type { TemplateView, EventState, EventView, Preview };

const LOCALES: Locale[] = ['de-DE', 'en-US'];
export const SUBJECT_MAX = 200;
export const BODY_MAX = 5000;

interface Stored extends EmailTemplate {
  storeKey: string;
  updatedAt: string;
}

const keyOf = (storeKey: string, template: TemplateKey) => storeObjectKey(storeKey, template);

function isEmailTemplate(v: unknown, storeKey: string): v is Stored {
  const t = v as Stored | null;
  return !!t && t.storeKey === storeKey && typeof t.enabled === 'boolean' && LOCALES.every((l) => typeof t.subject?.[l] === 'string' && typeof t.body?.[l] === 'string');
}

async function readStored(storeKey: string, key: TemplateKey): Promise<Stored | null> {
  const object = await readObject<Stored>(CONTAINERS.templates, keyOf(storeKey, key));
  return object && isEmailTemplate(object.value, storeKey) ? object.value : null;
}

export async function getTemplate(storeKey: string, key: string): Promise<TemplateView> {
  if (!isTemplateKey(key)) throw new CatalogError(404, 'TEMPLATE_NOT_FOUND', 'Not found');
  const stored = await readStored(storeKey, key);
  const source = stored ?? DEFAULT_TEMPLATES[key];
  return { key, subject: { ...source.subject }, body: { ...source.body }, enabled: source.enabled, stored: stored !== null };
}

export async function listTemplates(storeKey: string): Promise<TemplateView[]> {
  return Promise.all(TEMPLATE_KEYS.map((key) => getTemplate(storeKey, key)));
}

/** 400 `UNKNOWN_VARIABLE` (with `variable`) or `UNBALANCED_BRACES`, naming nothing else; length limits are 400 `TOO_LONG`. */
export function assertTemplateText(input: Pick<EmailTemplate, 'subject' | 'body'>): void {
  for (const locale of LOCALES) {
    for (const [field, text, max] of [['subject', input.subject[locale], SUBJECT_MAX], ['body', input.body[locale], BODY_MAX]] as const) {
      if (text.length > max) throw new CatalogError(400, 'TOO_LONG', `The ${field} is longer than ${max} characters`);
      const problem = templateProblem(text);
      if (problem?.code === 'UNKNOWN_VARIABLE') throw new CatalogError(400, 'UNKNOWN_VARIABLE', `Unknown variable ${problem.variable}`, { variable: problem.variable });
      if (problem) throw new CatalogError(400, 'UNBALANCED_BRACES', 'A variable is not closed: use {{name}}');
    }
  }
}

export async function saveTemplate(storeKey: string, key: string, input: EmailTemplate, now: number = Date.now()): Promise<TemplateView> {
  if (!isTemplateKey(key)) throw new CatalogError(404, 'TEMPLATE_NOT_FOUND', 'Not found');
  assertTemplateText(input);
  await upsertObject<Stored>(CONTAINERS.templates, keyOf(storeKey, key), () => ({ storeKey, subject: { ...input.subject }, body: { ...input.body }, enabled: input.enabled, updatedAt: new Date(now).toISOString() }));
  return getTemplate(storeKey, key);
}

/** Renders unsaved text with the sample order (`MO-482913`, `Alex Muster`). The text is validated first; nothing is stored or sent. */
export function previewTemplate(input: Pick<EmailTemplate, 'subject' | 'body'>): Preview {
  assertTemplateText(input);
  const vars: Record<string, string> = { ...SAMPLE_VARIABLES };
  return {
    subject: { 'de-DE': renderText(input.subject['de-DE'], vars), 'en-US': renderText(input.subject['en-US'], vars) },
    html: { 'de-DE': renderTemplate(input.body['de-DE'], vars), 'en-US': renderTemplate(input.body['en-US'], vars) },
  };
}

/** "Stored, not sent" for an event whose saved template is enabled, else "Not set up". Nothing ever reads "Live". */
export async function listEvents(storeKey: string): Promise<EventView[]> {
  return Promise.all(
    TRANSACTIONAL_EVENTS.map(async (event) => {
      const stored = event.template ? await readStored(storeKey, event.template) : null;
      return { id: event.id, template: event.template, state: stored?.enabled ? ('stored-not-sent' as const) : ('not-set-up' as const) };
    }),
  );
}
