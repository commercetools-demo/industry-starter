import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { renderShell } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import SubscribeStrip from '@/components/home/SubscribeStrip';

describe('SubscribeStrip', () => {
  it('Entry point: Shop subscriptions links to the listing filtered to subscribable products', () => {
    renderShell(<SubscribeStrip available />);
    expect(screen.getByRole('link', { name: 'Shop subscriptions' })).toHaveAttribute('href', '/shop?f_collection=subscribable');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('subscribe strip hidden when nothing is subscribable', () => {
    renderShell(<SubscribeStrip available={false} />);
    expect(screen.queryByTestId('home-subscribe')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Shop subscriptions' })).toBeNull();
  });

  it('strip never shows a hard coded percent', () => {
    const { container } = renderShell(<SubscribeStrip available />);
    expect(container.textContent).not.toMatch(/\d+\s?%/);
    for (const locale of ['en-US', 'en-CA']) {
      const catalogue = JSON.parse(readFileSync(join(process.cwd(), 'messages', `${locale}.json`), 'utf8'));
      expect(JSON.stringify(catalogue.home.subscribe)).not.toMatch(/%/);
    }
  });

  it('has no accessibility violations', async () => {
    const { container } = renderShell(<SubscribeStrip available />);
    await expectNoAxeViolations(container);
  });
});
