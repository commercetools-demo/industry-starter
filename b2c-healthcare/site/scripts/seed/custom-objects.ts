import { withRetry, realSleep, type Ctx, type EnsureResult, type Root } from './lib';

/** Custom Object helpers for the seed scripts (admin client). The storefront uses lib/ct/custom-objects.ts instead. */

export interface SeedObject { key: string; version: number; value: unknown }

const notFound = (e: unknown) => (e as { statusCode?: number }).statusCode === 404;

export async function getObject(root: Root, container: string, key: string): Promise<SeedObject | null> {
  try {
    const { body } = await withRetry(() => root.customObjects().withContainerAndKey({ container, key }).get().execute());
    return { key: body.key, version: body.version, value: body.value };
  } catch (e) {
    if (notFound(e)) return null;
    throw e;
  }
}

/** Every object of a container (pages of 200). */
export async function listObjects(root: Root, container: string): Promise<SeedObject[]> {
  const out: SeedObject[] = [];
  for (let offset = 0; ; offset += 200) {
    const { body } = await withRetry(() => root.customObjects().withContainer({ container }).get({ queryArgs: { limit: 200, offset } }).execute());
    out.push(...body.results.map((o) => ({ key: o.key, version: o.version, value: o.value })));
    if (body.results.length < 200) return out;
  }
}

/** Stable JSON: object keys sorted, so a value read back from the platform compares equal to the draft. */
export const stable = (v: unknown): string => JSON.stringify(v, (_k, x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

/**
 * Create-if-missing (create-only `version: 0`). An existing object is compared when `compare` is `'value'`
 * (a difference is reported, never overwritten) and left alone when it is `'exists'` (data the storefront changes, such as refills).
 */
export async function ensureObject(ctx: Ctx, container: string, key: string, value: unknown, compare: 'value' | 'exists' = 'value'): Promise<EnsureResult> {
  const existing = await getObject(ctx.root, container, key);
  if (!existing) {
    if (ctx.dryRun) return 'would-create';
    await withRetry(() => ctx.root.customObjects().post({ body: { container, key, value: value as never, version: 0 } }).execute(), ctx.sleep);
    if (ctx.pauseMs) await (ctx.sleep ?? realSleep)(ctx.pauseMs);
    return 'created';
  }
  if (compare === 'exists') return 'ok';
  return stable(existing.value) === stable(value) ? 'ok' : { diff: `custom object ${container}/${key} differs from the seed data` };
}
