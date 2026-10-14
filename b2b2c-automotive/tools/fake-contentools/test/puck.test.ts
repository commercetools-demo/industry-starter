// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
//
// Contract tests for Puck pages and contents. Source of truth: routes/puck-page.route.ts, routes/puck-content.route.ts,
// controllers/puck-page.controller.ts, puck-content.controller.ts, content-state-controller.ts (real service).
import { describe, expect, it } from 'vitest';
import { bearer, NORTH, projectHeader, SOUTH, useFake } from './helpers.ts';

const api = useFake();
const queryHome = { query: 'slug = "/home"' };

describe('published puck pages', () => {
  it('POST published/puck-pages/query returns the page value with puckData (what the storefront reads)', async () => {
    const r = await api.call('POST', `/service/${NORTH}/published/puck-pages/query`, { headers: projectHeader, json: queryHome });
    expect(r.status).toBe(200);
    expect(r.body.slug).toBe('/home');
    expect(r.body.businessUnitKey).toBe(NORTH);
    const types = r.body.puckData.content.map((c: { type: string }) => c.type);
    expect(types).toEqual(['AutomotiveHero', 'CategoryTiles', 'PromoBanner', 'PopularProducts', 'BrandStrip']);
    expect(r.body.puckData.content[0].props.id).toBeTruthy();
  });

  it('each store has its own home page (no sharing between business units)', async () => {
    const a = await api.call('POST', `/service/${NORTH}/published/puck-pages/query`, { headers: projectHeader, json: queryHome });
    const b = await api.call('POST', `/service/${SOUTH}/published/puck-pages/query`, { headers: projectHeader, json: queryHome });
    expect(a.body.key).not.toBe(b.body.key);
    expect(b.body.puckData.content.map((c: { type: string }) => c.type)).toContain('VehicleFinder');
  });

  it('there is NO fallback to the default namespace for pages: unknown store answers 404', async () => {
    const r = await api.call('POST', '/service/mau-reseller-unknown/published/puck-pages/query', { headers: projectHeader, json: queryHome });
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ message: 'Published puck page not found' });
  });

  it('a draft-only page is not published: 404', async () => {
    const r = await api.call('POST', `/service/${NORTH}/published/puck-pages/query`, { headers: projectHeader, json: { query: 'slug = "/about"' } });
    expect(r.status).toBe(404);
    expect(r.body.message).toBe('Published puck page not found');
  });

  it('...but the preview query finds the draft', async () => {
    const r = await api.call('POST', `/service/${NORTH}/preview/puck-pages/query`, { headers: projectHeader, json: { query: 'slug = "/about"' } });
    expect(r.status).toBe(200);
    expect(r.body.name).toBe('About us');
  });

  it('an unknown slug answers 404', async () => {
    const r = await api.call('POST', `/service/${NORTH}/published/puck-pages/query`, { headers: projectHeader, json: { query: 'slug = "/nope"' } });
    expect(r.status).toBe(404);
  });

  it('a missing query answers 400 "query is required in request body"', async () => {
    const r = await api.call('POST', `/service/${NORTH}/published/puck-pages/query`, { headers: projectHeader, json: {} });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ message: 'query is required in request body' });
  });

  it('a predicate the commercetools query language would reject answers 400 (Failed to get custom objects)', async () => {
    const r = await api.call('POST', `/service/${NORTH}/published/puck-pages/query`, { headers: projectHeader, json: { query: 'slug = /home' } });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/^Failed to get custom objects/);
  });

  it('the query needs x-project-key but no JWT', async () => {
    const noKey = await api.call('POST', `/service/${NORTH}/published/puck-pages/query`, { json: queryHome });
    expect(noKey.status).toBe(400);
    const ok = await api.call('POST', `/service/${NORTH}/published/puck-pages/query`, { headers: projectHeader, json: queryHome });
    expect(ok.status).toBe(200);
  });

  it('GET published/puck-pages/:key returns the published value, 404 for an unpublished page', async () => {
    const ok = await api.call('GET', `/service/${NORTH}/published/puck-pages/puck-page-north-home`, { headers: projectHeader });
    expect(ok.status).toBe(200);
    const miss = await api.call('GET', `/service/${NORTH}/published/puck-pages/puck-page-north-about`, { headers: projectHeader });
    expect(miss.status).toBe(404);
    expect(miss.body.message).toBe('Published puck page not found');
  });

  it('the published page is looked up in the state of the requested business unit only', async () => {
    const r = await api.call('GET', `/service/${SOUTH}/published/puck-pages/puck-page-north-home`, { headers: projectHeader });
    expect(r.status).toBe(404);
  });
});

describe('puck page authoring', () => {
  const create = async (bu = NORTH): Promise<{ status: number; body: any }> =>
    api.call('POST', `/service/${bu}/puck-pages`, {
      headers: bearer(),
      json: { value: { name: 'Promo', slug: '/promo', puckData: { content: [], root: { props: {} } } } },
    });

  it('create answers 201 with the custom object envelope and a generated puck-page-<uuid> key', async () => {
    const r = await create();
    expect(r.status).toBe(201);
    expect(r.body.container).toBe('puck-page');
    expect(r.body.key).toMatch(/^puck-page-[0-9a-f-]{36}$/);
    expect(r.body.version).toBe(1);
    expect(r.body.value).toMatchObject({ name: 'Promo', slug: '/promo', businessUnitKey: NORTH });
  });

  it('a new page is a draft only: not published until publish is called', async () => {
    const created = await create();
    const q = { query: 'slug = "/promo"' };
    expect((await api.call('POST', `/service/${NORTH}/published/puck-pages/query`, { headers: projectHeader, json: q })).status).toBe(404);
    const states = await api.call('GET', `/service/${NORTH}/puck-pages/${created.body.key}/states`, { headers: projectHeader });
    expect(Object.keys(states.body.states)).toEqual(['draft']);

    const pub = await api.call('PUT', `/service/${NORTH}/puck-pages/${created.body.key}/states/published`, { headers: bearer() });
    expect(pub.status).toBe(200);
    expect(pub.body.states.published.slug).toBe('/promo');
    expect((await api.call('POST', `/service/${NORTH}/published/puck-pages/query`, { headers: projectHeader, json: q })).status).toBe(200);
  });

  it('publish with ?clearDraft=true removes the draft', async () => {
    const created = await create();
    const pub = await api.call('PUT', `/service/${NORTH}/puck-pages/${created.body.key}/states/published?clearDraft=true`, { headers: bearer() });
    expect(pub.body.states.draft).toBeUndefined();
    expect(pub.body.states.published).toBeTruthy();
  });

  it('create validates name and slug with 400', async () => {
    const noName = await api.call('POST', `/service/${NORTH}/puck-pages`, { headers: bearer(), json: { value: { slug: '/x' } } });
    expect(noName.status).toBe(400);
    expect(noName.body.message).toBe('name is required');
    const noSlug = await api.call('POST', `/service/${NORTH}/puck-pages`, { headers: bearer(), json: { value: { name: 'x' } } });
    expect(noSlug.body.message).toBe('slug is required');
    const noValue = await api.call('POST', `/service/${NORTH}/puck-pages`, { headers: bearer(), json: {} });
    expect(noValue.body.message).toBe('value is required in request body');
  });

  it('update merges into the page, bumps version and saves a draft state plus a version entry', async () => {
    const created = await create();
    const up = await api.call('PUT', `/service/${NORTH}/puck-pages/${created.body.key}`, { headers: bearer(), json: { value: { name: 'Renamed' } } });
    expect(up.status).toBe(200);
    expect(up.body.version).toBe(2);
    expect(up.body.value.name).toBe('Renamed');
    expect(up.body.value.slug).toBe('/promo');
    const versions = await api.call('GET', `/service/${NORTH}/puck-pages/${created.body.key}/versions`, { headers: projectHeader });
    expect(versions.body.versions).toHaveLength(2);
    expect(versions.body.versions[0].name).toBe('Renamed');
  });

  it('keeps at most 5 versions (MAX_VERSIONS)', async () => {
    const created = await create();
    for (let i = 0; i < 7; i++) {
      await api.call('PUT', `/service/${NORTH}/puck-pages/${created.body.key}`, { headers: bearer(), json: { value: { name: `v${i}` } } });
    }
    const versions = await api.call('GET', `/service/${NORTH}/puck-pages/${created.body.key}/versions`, { headers: projectHeader });
    expect(versions.body.versions).toHaveLength(5);
  });

  it('update of a missing page answers 404 "Custom object not found with key"', async () => {
    const r = await api.call('PUT', `/service/${NORTH}/puck-pages/puck-page-missing`, { headers: bearer(), json: { value: { name: 'x' } } });
    expect(r.status).toBe(404);
    expect(r.body.message).toBe('Custom object not found with key: puck-page-missing');
  });

  it('list returns the business unit pages with their states', async () => {
    const r = await api.call('GET', `/service/${NORTH}/puck-pages`, { headers: projectHeader });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body.map((p: { key: string }) => p.key).sort()).toEqual(['puck-page-north-about', 'puck-page-north-home']);
    const home = r.body.find((p: { key: string }) => p.key === 'puck-page-north-home');
    expect(Object.keys(home.states)).toEqual(['published']);
  });

  it('get by key returns the object with states; unknown key is 404', async () => {
    const r = await api.call('GET', `/service/${NORTH}/puck-pages/puck-page-north-home`, { headers: projectHeader });
    expect(r.status).toBe(200);
    expect(r.body.states.published.slug).toBe('/home');
    expect((await api.call('GET', `/service/${NORTH}/puck-pages/nope`, { headers: projectHeader })).status).toBe(404);
  });

  it('delete answers 204 and the page is gone', async () => {
    const created = await create();
    const r = await api.call('DELETE', `/service/${NORTH}/puck-pages/${created.body.key}`, { headers: bearer() });
    expect(r.status).toBe(204);
    expect((await api.call('GET', `/service/${NORTH}/puck-pages/${created.body.key}`, { headers: projectHeader })).status).toBe(404);
  });

  it('revert draft: 404 "No published state found" for a never-published page, otherwise drops the draft', async () => {
    const created = await create();
    const bad = await api.call('DELETE', `/service/${NORTH}/puck-pages/${created.body.key}/states/draft`, { headers: bearer() });
    expect(bad.status).toBe(404);
    expect(bad.body.message).toBe('No published state found');
    await api.call('PUT', `/service/${NORTH}/puck-pages/${created.body.key}/states/published`, { headers: bearer() });
    await api.call('PUT', `/service/${NORTH}/puck-pages/${created.body.key}`, { headers: bearer(), json: { value: { name: 'Edited' } } });
    const ok = await api.call('DELETE', `/service/${NORTH}/puck-pages/${created.body.key}/states/draft`, { headers: bearer() });
    expect(ok.status).toBe(200);
    expect(ok.body.states.draft).toBeUndefined();
  });

  it('every write route rejects a missing Authorization header with 401 before doing anything', async () => {
    const created = await create();
    const k = created.body.key as string;
    const calls: Array<[string, string, unknown?]> = [
      ['POST', `/service/${NORTH}/puck-pages`, { value: { name: 'x', slug: '/x' } }],
      ['PUT', `/service/${NORTH}/puck-pages/${k}`, { value: { name: 'x' } }],
      ['DELETE', `/service/${NORTH}/puck-pages/${k}`],
      ['PUT', `/service/${NORTH}/puck-pages/${k}/states/published`],
      ['DELETE', `/service/${NORTH}/puck-pages/${k}/states/draft`],
      ['POST', `/service/${NORTH}/puck-contents`, { value: { name: 'x', contentType: 'y' } }],
    ];
    for (const [method, path, json] of calls) {
      const r = await api.call(method, path, { headers: projectHeader, ...(json ? { json } : {}) });
      expect(r.status, `${method} ${path}`).toBe(401);
    }
    expect((await api.call('GET', `/service/${NORTH}/puck-pages/${k}`, { headers: projectHeader })).body.value.name).toBe('Promo');
  });
});

describe('puck contents', () => {
  it('published query by contentType and name works like pages', async () => {
    const r = await api.call('POST', `/service/${NORTH}/published/puck-contents/query`, {
      headers: projectHeader,
      json: { query: 'contentType = "announcement"' },
    });
    expect(r.status).toBe(200);
    expect(r.body.data.text).toMatch(/Bremen/);
  });

  it('unknown content answers 404 "Published puck content not found"', async () => {
    const r = await api.call('GET', `/service/${NORTH}/published/puck-contents/nope`, { headers: projectHeader });
    expect(r.status).toBe(404);
    expect(r.body.message).toBe('Published puck content not found');
  });

  it('list filters by ?contentType', async () => {
    const hit = await api.call('GET', `/service/${NORTH}/puck-contents?contentType=announcement`, { headers: projectHeader });
    expect(hit.body).toHaveLength(1);
    const miss = await api.call('GET', `/service/${NORTH}/puck-contents?contentType=other`, { headers: projectHeader });
    expect(miss.body).toHaveLength(0);
  });

  it('create validates name and contentType; 201 with puck-content-<uuid> key', async () => {
    const bad = await api.call('POST', `/service/${NORTH}/puck-contents`, { headers: bearer(), json: { value: { name: 'x' } } });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toBe('contentType is required');
    const ok = await api.call('POST', `/service/${NORTH}/puck-contents`, { headers: bearer(), json: { value: { name: 'x', contentType: 'faq', data: { a: 1 } } } });
    expect(ok.status).toBe(201);
    expect(ok.body.key).toMatch(/^puck-content-/);
    expect(ok.body.container).toBe('puck-content');
  });

  it('a business unit never sees another one\'s contents', async () => {
    const r = await api.call('GET', `/service/${SOUTH}/puck-contents`, { headers: projectHeader });
    expect(r.body).toEqual([]);
  });
});
