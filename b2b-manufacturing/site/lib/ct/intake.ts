/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { validateEnv, type CtpConfig } from '../env';
import type { IntakeEntity } from '../intake/types';
import { contentTypeOf, type OutputType } from '../intake/validation';

export type { IntakeEntity };

/**
 * The commercetools Intake API over raw HTTP (the SDK has no support for it). One synchronous call returns the created Cart, Quote Request
 * or Shopping List, or an error; there is no get, list or status endpoint, so callers keep their own record (intake-records.ts).
 */
export interface IntakeRequest { outputType: OutputType; locale: string; prompt: string; files: { name: string; data: Blob }[] }
export type IntakeResult =
  | { ok: true; entity: IntakeEntity; warnings: string[] }
  | { ok: false; code: string; message: string };

const tokenSchema = z.object({ access_token: z.string(), expires_in: z.number() });
/** Success: `{ entityType, entity: <the created Cart | QuoteRequest | ShoppingList>, threadId, warnings? }` (seen in a real 201). */
const successSchema = z.object({
  entityType: z.string().optional(),
  entity: z.object({ id: z.string(), cartId: z.string().optional(), cart: z.object({ id: z.string() }).optional() }).passthrough(),
  cartId: z.string().optional(),
  warnings: z.array(z.object({ code: z.string() }).passthrough()).optional(),
}).passthrough();
const errorSchema = z.object({ message: z.string().optional(), errors: z.array(z.object({ code: z.string(), message: z.string().optional() }).passthrough()).optional() }).passthrough();

let cached: { key: string; token: string; expiresAt: number } | undefined;

/** Client-credentials token with the configured scopes (including `manage_intake_agent`), cached until shortly before it expires. */
async function accessToken(config: CtpConfig): Promise<string> {
  const key = `${config.authUrl}|${config.clientId}`;
  if (cached && cached.key === key && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const res = await fetch(`${config.authUrl.replace(/\/$/, '')}/oauth/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: config.scopes }),
  });
  if (!res.ok) throw new Error(`Token request failed (${res.status})`);
  const body = tokenSchema.parse(await res.json());
  cached = { key, token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

/** Test hook: forget the cached token. */
export const resetIntakeToken = (): void => { cached = undefined; };

const quote = (value: string): string => value.replace(/[\r\n"]/g, '_');

/**
 * Text-only requests are JSON. With files the body is multipart, built by hand: `FormData` gives every Blob part a filename, and Intake
 * treats a part with a filename as a file ("Unexpected file field 'payload'"). The `payload` part must have a content type and no filename.
 */
export async function intakeBody(request: IntakeRequest): Promise<{ body: BodyInit; headers: Record<string, string> }> {
  const payload = JSON.stringify({ outputType: request.outputType, locale: request.locale, prompt: request.prompt });
  if (request.files.length === 0) return { body: payload, headers: { 'Content-Type': 'application/json' } };
  const boundary = `----intake${randomUUID().replace(/-/g, '')}`;
  const text = (value: string) => new TextEncoder().encode(value);
  const chunks: BlobPart[] = [text(`--${boundary}\r\nContent-Disposition: form-data; name="payload"\r\nContent-Type: application/json\r\n\r\n${payload}\r\n`)];
  for (const file of request.files) {
    chunks.push(text(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${quote(file.name)}"\r\nContent-Type: ${contentTypeOf(file.name) ?? 'application/octet-stream'}\r\n\r\n`));
    chunks.push(await file.data.arrayBuffer(), '\r\n');
  }
  chunks.push(`--${boundary}--\r\n`);
  return { body: new Blob(chunks), headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` } };
}

/** Raw commercetools request and response, for debugging. On outside production; set INTAKE_DEBUG=1 to turn it on there (the prompt carries the customer email). */
const debugOn = (): boolean => process.env.INTAKE_DEBUG === '1' || process.env.NODE_ENV !== 'production';
const debugLog = (label: string, data: unknown): void => { if (debugOn()) console.log(`[intake] ${label} ${JSON.stringify(data, null, 2)}`); };

export async function callIntake(request: IntakeRequest, config: CtpConfig = validateEnv(process.env)): Promise<IntakeResult> {
  const token = await accessToken(config);
  const { body, headers } = await intakeBody(request);
  const url = `${config.apiUrl.replace(/\/$/, '')}/${config.projectKey}/agents/intake/v1/responses`;
  debugLog('request', {
    method: 'POST', url, headers: { Authorization: 'Bearer <redacted>', ...headers },
    payload: { outputType: request.outputType, locale: request.locale, prompt: request.prompt },
    files: request.files.map((f) => ({ name: f.name, type: contentTypeOf(f.name), size: f.data.size })),
  });
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, ...headers }, body });
  const text = await res.text();
  debugLog('response', { status: res.status, headers: Object.fromEntries(res.headers.entries()), body: text });
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { raw = undefined; }
  if (res.ok) {
    const parsed = successSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, code: 'UnexpectedResponse', message: `Intake answered ${res.status} with a body we could not read: ${parsed.error.issues[0]?.path.join('.') || 'body'} ${parsed.error.issues[0]?.message ?? ''}`.trim() };
    const { entity } = parsed.data;
    const cartId = entity.cartId ?? entity.cart?.id ?? parsed.data.cartId;
    return { ok: true, entity: { type: request.outputType, id: entity.id, ...(cartId ? { cartId } : {}) }, warnings: (parsed.data.warnings ?? []).map((w) => w.code) };
  }
  if (res.status === 401 || res.status === 403) cached = undefined;
  const error = errorSchema.safeParse(raw).data;
  const first = error?.errors?.[0];
  const code = first?.code ?? (res.status === 401 || res.status === 403 ? 'NotAuthorized' : 'IntakeFailed');
  // Intake's own sentence is shown as is; it is meant for the caller and carries nothing secret.
  const message = first?.message ?? error?.message ?? (text ? text.slice(0, 300) : `Intake answered ${res.status} with no body.`);
  return { ok: false, code, message };
}
