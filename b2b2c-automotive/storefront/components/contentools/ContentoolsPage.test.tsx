// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ContentoolsPage } from './ContentoolsPage';
import { textPage } from './ContentoolsPage.fixture';

const base = { storeKey: 'mau-reseller-north', projectKey: 'proj-1', locale: 'en-US' };

describe('Contentools reads and the same-origin proxy: ContentoolsPage', () => {
  it('No page', () => {
    render(
      <ContentoolsPage {...base} data={null}>
        <p>Fallback layout</p>
      </ContentoolsPage>,
    );
    expect(screen.getByText('Fallback layout')).toBeInTheDocument();
    expect(document.querySelector('.puck-page')).toBeNull();
  });
  it('Published page renders blocks', () => {
    render(
      <ContentoolsPage {...base} data={textPage}>
        <p>Fallback layout</p>
      </ContentoolsPage>,
    );
    expect(screen.getByText('Puck says hello')).toBeInTheDocument();
    expect(screen.queryByText('Fallback layout')).toBeNull();
    expect(document.querySelector('.puck-page')).not.toBeNull();
  });
});
