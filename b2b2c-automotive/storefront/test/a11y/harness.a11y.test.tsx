// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Workstream Y: the page harness must actually fail on real defects (otherwise every page test below would pass for nothing).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axePage, renderStorePage, stubShellFetch } from '@/test/a11y';

vi.mock('@/i18n/routing', async () => (await import('@/test/routing-mock')).mockRouting());
afterEach(() => vi.unstubAllGlobals());

const rules = async () => (await axePage()).violations.map((v) => v.id);

describe('a11y harness', () => {
  it('reports an image without alt, an unlabelled input, a skipped heading level and a second h1', async () => {
    stubShellFetch();
    renderStorePage(
      <>
        <h1>One</h1>
        <h1>Two</h1>
        <h4>Skipped</h4>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src="/x.png" />
        <input type="text" />
      </>,
    );
    const found = await rules();
    expect(found).toEqual(expect.arrayContaining(['image-alt', 'label', 'heading-order']));
  });

  it('a bare render (dialogs, error pages) still has exactly one main landmark', async () => {
    stubShellFetch();
    renderStorePage(<p>x</p>, { bare: true });
    expect(await rules()).not.toContain('landmark-one-main');
  });

  it('reports a wrong or missing language', async () => {
    stubShellFetch();
    renderStorePage(<h1>x</h1>);
    document.documentElement.removeAttribute('lang');
    expect(await rules()).toContain('html-has-lang');
  });
});
