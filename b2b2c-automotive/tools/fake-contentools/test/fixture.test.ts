// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultTheme } from '../../../seed/src/data/content.ts';
import { buildFixture, FIXTURE_OUTPUT } from '../scripts/export-theme-fixture.ts';
import type { Fixture } from '../src/state.ts';

const committed = JSON.parse(readFileSync(FIXTURE_OUTPUT, 'utf8')) as Fixture;

// plans/workstreams/K-home-page-puck.md section 4
const AUTOMOTIVE_BLOCKS = ['AutomotiveHero', 'VehicleFinder', 'CategoryTiles', 'PopularProducts', 'PromoBanner', 'BrandStrip'];

describe('fixtures/contentools.json', () => {
  it('is exactly what scripts/export-theme-fixture.ts builds (run `npm run fixture` when this fails)', () => {
    expect(committed).toEqual(JSON.parse(JSON.stringify(buildFixture())));
  });

  it('the default theme equals the seed defaultTheme', () => {
    expect(committed.themes.default).toEqual(JSON.parse(JSON.stringify(defaultTheme)));
  });

  it('both reseller stores have a theme that differs from the default and from each other', () => {
    const north = committed.themes['mau-reseller-north'];
    const south = committed.themes['mau-reseller-south'];
    expect(north?.colorPrimary).not.toBe(defaultTheme.colorPrimary);
    expect(south?.colorPrimary).not.toBe(defaultTheme.colorPrimary);
    expect(north?.colorPrimary).not.toBe(south?.colorPrimary);
  });

  it('every theme carries every ThemeTokens field of the default (so the adapter has complete documents)', () => {
    for (const theme of Object.values(committed.themes)) {
      expect(Object.keys(theme).sort()).toEqual(Object.keys(defaultTheme).sort());
    }
  });

  it('each store has a published /home page that uses only registered automotive blocks', () => {
    for (const store of ['mau-reseller-north', 'mau-reseller-south']) {
      const home = committed.pages.find((p) => p.businessUnitKey === store && p.slug === '/home');
      expect(home?.status, store).toBe('published');
      const types = (home?.puckData.content as Array<{ type: string; props: { id: string } }>).map((c) => c.type);
      expect(types.length).toBeGreaterThan(2);
      for (const t of types) expect(AUTOMOTIVE_BLOCKS, `${store}: ${t}`).toContain(t);
      const ids = (home?.puckData.content as Array<{ props: { id: string } }>).map((c) => c.props.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('contains no secret-like or commercetools-specific values', () => {
    const text = JSON.stringify(committed);
    expect(text).not.toMatch(/client_secret|CTP_|Bearer|password|eyJ[A-Za-z0-9]/i);
  });
});
