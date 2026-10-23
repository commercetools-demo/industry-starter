// Live, read-only probe for workstream D (D-10). Needs OA-01 (storefront/.env.local). Run: npm run test:live
// Records names and counts only: no ids of customers, no secrets, no response bodies.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apiRoot } from '@/lib/ct/client';

const evidence = join(process.cwd(), '..', 'plans', 'evidence', 'D');
const out: Record<string, unknown> = {};

function describeError(e: unknown) {
  const err = e as {
    statusCode?: number; headers?: Record<string, unknown>;
    originalRequest?: { headers?: Record<string, unknown> };
  };
  return {
    typeofError: typeof e,
    keys: typeof e === 'object' && e !== null ? Object.keys(e) : [],
    statusCode: err.statusCode,
    responseHeaderNames: Object.keys(err.headers ?? {}),
    correlationIdInResponseHeaders: Boolean(err.headers?.['x-correlation-id']),
    requestHeaderNames: Object.keys(err.originalRequest?.headers ?? {}),
    correlationIdInRequestHeaders: Boolean(err.originalRequest?.headers?.['X-Correlation-ID']),
  };
}

describe('live probe (read-only)', () => {
  it('1 project settings', async () => {
    const { body } = await apiRoot.get().execute();
    out.project = {
      key: body.key,
      countries: body.countries,
      currencies: body.currencies,
      languages: body.languages,
      searchIndexing: body.searchIndexing ? Object.keys(body.searchIndexing) : null,
    };
    expect(body.key).toBeTruthy();
  });

  it('2 error shape of a 404', async () => {
    try {
      await apiRoot.products().withId({ ID: 'does-not-exist' }).get().execute();
      out.errorShape = 'no error thrown';
    } catch (e) {
      out.errorShape = describeError(e);
    }
  });

  it('3 product projection shape', async () => {
    const { body } = await apiRoot
      .productProjections()
      .get({ queryArgs: { limit: 1, priceCurrency: 'USD', priceCountry: 'US', staged: false } })
      .execute();
    const first = body.results[0];
    if (!first) {
      out.projection = 'no products (re-run after C-12)';
      return;
    }
    out.projection = {
      topLevelKeys: Object.keys(first),
      hasReviewRatingStatistics: 'reviewRatingStatistics' in first,
      hasProductAttributes: 'attributes' in first,
      masterVariantKeys: Object.keys(first.masterVariant),
      masterVariantHasScopedPrice: Boolean(first.masterVariant.price),
      imageKeys: first.masterVariant.images?.[0] ? Object.keys(first.masterVariant.images[0]) : [],
    };
  });

  it('4 reviews read scope', async () => {
    try {
      const res = await apiRoot.reviews().get({ queryArgs: { limit: 1 } }).execute();
      out.reviewsRead = { statusCode: res.statusCode };
    } catch (e) {
      out.reviewsRead = { statusCode: (e as { statusCode?: number }).statusCode, note: '403 means view_products is missing' };
    }
  });

  it('writes the evidence file', () => {
    mkdirSync(evidence, { recursive: true });
    writeFileSync(join(evidence, 'probe.json'), `${JSON.stringify(out, null, 2)}\n`);
  });
});
