// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
//
// Contract tests: each case states the real behaviour it mirrors
// (<contentools-repo>/service/src/routes/configuration.route.ts and controllers/configuration.controller.ts).
import { describe, expect, it } from 'vitest';
import { defaultTheme } from '../../../seed/src/data/content.ts';
import { bearer, NORTH, projectHeader, SOUTH, useFake } from './helpers.ts';

const api = useFake();

describe('GET /service/:bu/configuration/theme', () => {
  it('returns the store theme (container configuration, key {bu}-theme) with 200', async () => {
    const r = await api.call('GET', `/service/${NORTH}/configuration/theme`, { headers: projectHeader });
    expect(r.status).toBe(200);
    expect(r.body.colorPrimary).toBe('#1d3b78');
    expect(r.headers.get('content-type')).toMatch(/application\/json/);
  });

  it('two stores have different themes', async () => {
    const a = await api.call('GET', `/service/${NORTH}/configuration/theme`, { headers: projectHeader });
    const b = await api.call('GET', `/service/${SOUTH}/configuration/theme`, { headers: projectHeader });
    expect(a.body.colorPrimary).not.toBe(b.body.colorPrimary);
  });

  it('falls back to the default namespace for a store without a theme (getTheme)', async () => {
    const r = await api.call('GET', '/service/mau-reseller-unknown/configuration/theme', { headers: projectHeader });
    expect(r.status).toBe(200);
    expect(r.body).toEqual(defaultTheme);
  });

  it('the default namespace equals the seed defaultTheme', async () => {
    const r = await api.call('GET', '/service/default/configuration/theme', { headers: projectHeader });
    expect(r.body).toEqual(defaultTheme);
  });

  it('answers 200 with a JSON null when not even a default theme exists (res.status(200).json(null))', async () => {
    api.fake().state.store.delete('configuration', 'default-theme');
    const r = await api.call('GET', '/service/mau-reseller-unknown/configuration/theme', { headers: projectHeader });
    expect(r.status).toBe(200);
    expect(r.text).toBe('null');
  });

  it('after a store theme is deleted the default is served again', async () => {
    await api.call('DELETE', `/service/${NORTH}/configuration/theme`, { headers: bearer() });
    const r = await api.call('GET', `/service/${NORTH}/configuration/theme`, { headers: projectHeader });
    expect(r.body).toEqual(defaultTheme);
  });

  it('needs no JWT', async () => {
    const r = await api.call('GET', `/service/${NORTH}/configuration/theme`, { headers: projectHeader });
    expect(r.status).toBe(200);
  });

  it('requires x-project-key: 400 with the real message', async () => {
    const r = await api.call('GET', `/service/${NORTH}/configuration/theme`);
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ message: 'x-project-key header is required' });
  });

  it('a blank x-project-key is treated as missing (value.trim())', async () => {
    const r = await api.call('GET', `/service/${NORTH}/configuration/theme`, { headers: { 'x-project-key': '   ' } });
    expect(r.status).toBe(400);
  });
});

describe('theme writes', () => {
  const put = { value: { colorPrimary: '#123456' } };

  it('POST creates with 201 and returns the value', async () => {
    const r = await api.call('POST', '/service/mau-reseller-new/configuration/theme', { headers: bearer(), json: put });
    expect(r.status).toBe(201);
    expect(r.body).toEqual(put.value);
    const g = await api.call('GET', '/service/mau-reseller-new/configuration/theme', { headers: projectHeader });
    expect(g.body).toEqual(put.value);
  });

  it('POST is an upsert: a second POST answers 201 again, never 409 (createCustomObject posts to custom-objects)', async () => {
    await api.call('POST', `/service/${NORTH}/configuration/theme`, { headers: bearer(), json: put });
    const r = await api.call('POST', `/service/${NORTH}/configuration/theme`, { headers: bearer(), json: { value: { colorPrimary: '#654321' } } });
    expect(r.status).toBe(201);
    const g = await api.call('GET', `/service/${NORTH}/configuration/theme`, { headers: projectHeader });
    expect(g.body.colorPrimary).toBe('#654321');
  });

  it('PUT answers 200 and also creates a missing object (updateCustomObject is an upsert)', async () => {
    const r = await api.call('PUT', '/service/mau-reseller-new/configuration/theme', { headers: bearer(), json: put });
    expect(r.status).toBe(200);
    expect(r.body).toEqual(put.value);
  });

  it('overwriting increments the custom object version', async () => {
    await api.call('PUT', `/service/${NORTH}/configuration/theme`, { headers: bearer(), json: put });
    expect(api.fake().state.store.get('configuration', `${NORTH}-theme`)?.version).toBe(2);
  });

  it('a missing value is rejected by the (simulated) commercetools call with 400', async () => {
    const r = await api.call('POST', `/service/${NORTH}/configuration/theme`, { headers: bearer(), json: {} });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/^Failed to create custom object/);
  });

  it('DELETE answers 204 with an empty body', async () => {
    const r = await api.call('DELETE', `/service/${NORTH}/configuration/theme`, { headers: bearer() });
    expect(r.status).toBe(204);
    expect(r.text).toBe('');
  });

  it('DELETE of a missing theme answers 500 (real quirk: the SDK promise is not awaited inside the try/catch)', async () => {
    const r = await api.call('DELETE', '/service/mau-reseller-none/configuration/theme', { headers: bearer() });
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ message: 'Internal server error' });
  });

  it('writes need the Authorization header: 401 "Authorization header missing"', async () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const r = await api.call(method, `/service/${NORTH}/configuration/theme`, { headers: projectHeader, json: put });
      expect(r.status, method).toBe(401);
      expect(r.body.message, method).toBe('Authorization header missing');
    }
    const g = await api.call('GET', `/service/${NORTH}/configuration/theme`, { headers: projectHeader });
    expect(g.body.colorPrimary).toBe('#1d3b78'); // unchanged
  });

  it('writes do not need x-project-key (the project comes from the JWT sub)', async () => {
    const r = await api.call('PUT', `/service/${NORTH}/configuration/theme`, { headers: bearer(), json: put });
    expect(r.status).toBe(200);
  });
});

describe('other configuration slices (same behaviour as the theme)', () => {
  it('header GET answers 200 null when nothing is stored', async () => {
    const r = await api.call('GET', `/service/${NORTH}/configuration/header`, { headers: projectHeader });
    expect(r.status).toBe(200);
    expect(r.text).toBe('null');
  });

  it('footer round trip with fallback to default', async () => {
    await api.call('POST', '/service/default/configuration/footer', { headers: bearer(), json: { value: { links: [] } } });
    const r = await api.call('GET', `/service/${NORTH}/configuration/footer`, { headers: projectHeader });
    expect(r.body).toEqual({ links: [] });
  });

  it('GET /:bu/configuration returns every slice (missing ones null) with the theme fallback', async () => {
    const r = await api.call('GET', '/service/mau-reseller-unknown/configuration', { headers: projectHeader });
    expect(r.status).toBe(200);
    expect(r.body.theme).toEqual(defaultTheme);
    expect(r.body.header).toBeNull();
    expect(Object.keys(r.body).sort()).toEqual(
      ['b2bAccountMenuLinks', 'categoryListing', 'contentoolsBaseUrl', 'facetConfiguration', 'footer', 'header', 'siteMetadata', 'theme', 'translations'],
    );
  });
});
