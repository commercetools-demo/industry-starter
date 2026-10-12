// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// SSR spike (H-08, Q-H02): does the renderer render on the server? See plans/evidence/H/spike-ssr.md for the outcome.
import type { PuckData } from '@commercetools-demo/puck-types';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContentoolsPage } from './ContentoolsPage';
import { textPage } from './ContentoolsPage.fixture';

describe('Published page: server render', () => {
  it('Published page is in the initial HTML', () => {
    const html = renderToString(<ContentoolsPage data={textPage} storeKey="mau-reseller-north" projectKey="proj-1" locale="en-US" />);
    expect(html).toContain('Puck says hello');
  });
  it('Rich text is sanitised in the server render', () => {
    const data = { content: [{ type: 'TextBlock', props: { id: 'T-2', content: '<p>ok</p><script>window.__pwned=1</script><img src=x onerror=alert(1)>' } }], root: { props: {} } } as unknown as PuckData;
    const html = renderToString(<ContentoolsPage data={data} storeKey="mau-reseller-north" projectKey="p" locale="en-US" />);
    expect(html).toContain('ok');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
  });
});
