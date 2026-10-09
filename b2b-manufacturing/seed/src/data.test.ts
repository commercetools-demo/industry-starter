import { describe, expect, it } from 'vitest';
import { categoryDrafts, faqItemTypeDraft, serviceTypeDraft, shippingMethodDraft, taxCategoryDraft, typeDrafts, zoneDraft } from './data/catalog';
import { DEMO_COMPANIES } from './data/demo';
import { buildPortalDemo, CONTAINERS } from './data/portal-demo';
import { buildProductDraft, buildRelatedActions } from './data/products';
import { PERMISSIONS, roleDrafts } from './data/roles';
import { FREQUENCIES, SECTORS, SERVICES, serviceKey } from './data/services';
import { SERVICES_DE } from './data/services.de';

const PLUMBING = ['Pipe installation & repair', 'Drain cleaning & CCTV survey', 'Backflow & water testing', 'Boiler & hot water', 'Commercial fit-outs'];
const WASTE = ['General waste collection', 'Recycling', 'Hazardous waste', 'Grease trap servicing', 'Medical / clinical waste', 'Liquid waste & tankering', 'Compliance reporting'];

describe('services', () => {
  it('has exactly the 5 plumbing and 7 waste services of the brief, in order', () => {
    expect(SERVICES.filter((s) => s.category === 'plumbing').map((s) => s.name)).toEqual(PLUMBING);
    expect(SERVICES.filter((s) => s.category === 'waste-management').map((s) => s.name)).toEqual(WASTE);
    expect(SERVICES).toHaveLength(12);
  });

  it('has unique, url-safe slugs and mpw- prefixed keys', () => {
    const slugs = SERVICES.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(12);
    for (const s of SERVICES) {
      expect(s.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(serviceKey(s.slug).startsWith('mpw-svc-')).toBe(true);
    }
  });

  it('uses only known sectors and frequencies and has enough long-form copy', () => {
    for (const s of SERVICES) {
      expect(s.sectors.length).toBeGreaterThan(0);
      for (const x of s.sectors) expect(SECTORS).toContain(x);
      for (const f of s.frequencies) expect(FREQUENCIES).toContain(f);
      expect(s.included.length).toBeGreaterThanOrEqual(4);
      expect(s.steps.length).toBeGreaterThanOrEqual(3);
      expect(s.records.length).toBeGreaterThanOrEqual(2);
      expect(s.faq).toHaveLength(3);
      expect(s.summary.length).toBeGreaterThan(20);
      expect(SERVICES_DE[s.slug]).toBeDefined();
      const de = SERVICES_DE[s.slug]!;
      expect(de.included).toHaveLength(s.included.length);
      expect(de.steps).toHaveLength(s.steps.length);
      expect(de.records).toHaveLength(s.records.length);
      expect(de.faq).toHaveLength(s.faq.length);
    }
  });

  it('relates only existing, other services (at most 3)', () => {
    const slugs = new Set(SERVICES.map((s) => s.slug));
    for (const s of SERVICES) {
      expect(s.related.length).toBeLessThanOrEqual(3);
      for (const r of s.related) {
        expect(slugs.has(r)).toBe(true);
        expect(r).not.toBe(s.slug);
      }
    }
  });

  it('asks for waste details only for hazardous, clinical and liquid waste', () => {
    expect(SERVICES.filter((s) => s.needsWasteDetails).map((s) => s.slug).sort()).toEqual(['hazardous-waste', 'liquid-waste-tankering', 'medical-clinical-waste']);
  });
});

describe('product drafts', () => {
  const def = SERVICES[1]!;
  const draft = buildProductDraft(def);

  it('carries the hidden 0 price in USD and EUR (D12), tax category and one category, and is published', () => {
    expect(draft.masterVariant?.prices).toEqual([{ value: { currencyCode: 'USD', centAmount: 0 } }, { value: { currencyCode: 'EUR', centAmount: 0 } }]);
    expect(draft.taxCategory?.key).toBe('mpw-service-vat');
    expect(draft.categories).toHaveLength(1);
    expect(draft.publish).toBe(true);
    expect(draft.masterVariant?.sku).toBe('MPW-DRAIN-CLEANING-CCTV-SURVEY');
  });

  it('sets every attribute of the product type and none outside it', () => {
    const defined = new Set((serviceTypeDraft.attributes ?? []).map((a) => a.name));
    const used = (draft.masterVariant?.attributes ?? []).map((a) => a.name);
    for (const n of used) expect(defined.has(n)).toBe(true);
    expect(used).toContain('faq');
    expect(used).toContain('sectors');
  });

  it('builds related actions from ids, never itself, and skips unknown slugs', () => {
    const ids = Object.fromEntries(SERVICES.map((s, i) => [s.slug, `id-${i}`]));
    const actions = buildRelatedActions(def, ids);
    expect(actions).toHaveLength(1);
    const value = (actions[0] as { value: { id: string }[] }).value;
    expect(value.map((v) => v.id)).not.toContain(ids[def.slug]);
    expect(buildRelatedActions(def, {})).toEqual([]);
  });
});

describe('catalog structure', () => {
  it('prefixes every key with mpw-', () => {
    const keys = [taxCategoryDraft.key, zoneDraft.key, shippingMethodDraft.key, faqItemTypeDraft.key, serviceTypeDraft.key, ...categoryDrafts.map((c) => c.key), ...typeDrafts.map((t) => t.key)];
    for (const k of keys) expect(k?.startsWith('mpw-')).toBe(true);
  });

  it('has a zero-rate default shipping method in USD and EUR', () => {
    expect(shippingMethodDraft.isDefault).toBe(true);
    expect(shippingMethodDraft.zoneRates?.[0]?.shippingRates?.map((r) => r.price)).toEqual([{ currencyCode: 'USD', centAmount: 0 }, { currencyCode: 'EUR', centAmount: 0 }]);
  });

  it('defines the quote-request custom fields the request form fills', () => {
    const t = typeDrafts.find((x) => x.key === 'mpw-quote-request');
    expect(t?.resourceTypeIds).toEqual(['quote']);
    expect(t?.fieldDefinitions?.map((f) => f.name)).toEqual(expect.arrayContaining(['sector', 'siteCount', 'wasteTypes', 'permitNumber', 'notes', 'contactName', 'jobTitle', 'phone', 'reference']));
  });
});

describe('associate roles', () => {
  it('use only permissions from the commercetools Permission enum (D19)', () => {
    for (const r of roleDrafts) for (const p of r.permissions) expect(PERMISSIONS).toContain(p);
  });

  it('give the admin quote-request creation and associate management, and finance read-only access', () => {
    const admin = roleDrafts.find((r) => r.key === 'mpw-admin')!;
    expect(admin.permissions).toEqual(expect.arrayContaining(['CreateMyQuoteRequestsFromMyCarts', 'UpdateAssociates', 'AcceptMyQuotes']));
    const finance = roleDrafts.find((r) => r.key === 'mpw-finance')!;
    for (const p of finance.permissions) expect(p.startsWith('View')).toBe(true);
    expect(finance.permissions).not.toContain('CreateMyQuoteRequestsFromMyCarts');
  });
});

describe('demo data', () => {
  it('uses synthetic example.com users with exactly one admin per company', () => {
    for (const c of DEMO_COMPANIES) {
      for (const u of c.users) expect(u.email.endsWith('@example.com')).toBe(true);
      expect(c.users.filter((u) => u.role === 'mpw-admin')).toHaveLength(1);
      expect(c.key.startsWith('mpw-')).toBe(true);
    }
  });

  it('generates portal records keyed by company, deterministically, with different data per company', () => {
    const a = buildPortalDemo();
    expect(buildPortalDemo()).toEqual(a);
    const demo = a.filter((o) => o.key.startsWith('mpw-demo-co.'));
    const other = a.filter((o) => o.key.startsWith('mpw-other-co.'));
    expect(demo.filter((o) => o.container === CONTAINERS.visits)).toHaveLength(12);
    expect(demo.filter((o) => o.container === CONTAINERS.wasteDocs)).toHaveLength(8);
    expect(demo.filter((o) => o.container === CONTAINERS.invoices)).toHaveLength(6);
    expect(other.length).toBeGreaterThan(0);
    expect(new Set(a.map((o) => `${o.container}/${o.key}`)).size).toBe(a.length);
    expect(demo.some((o) => (o.value as { status?: string }).status === 'Missed')).toBe(true);
    expect(demo.some((o) => (o.value as { status?: string }).status === 'Overdue')).toBe(true);
  });
});
