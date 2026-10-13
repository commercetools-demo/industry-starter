// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { act, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

const seen: Record<string, Record<string, unknown>> = {};
vi.mock('@commercetools-demo/puck-page-manager', () => ({
  PageManager: (props: Record<string, unknown>) => {
    seen.pages = props;
    return <div data-testid="pages" />;
  },
}));
vi.mock('@commercetools-demo/puck-content-manager', () => ({
  ContentManager: (props: Record<string, unknown>) => {
    seen.items = props;
    return <div data-testid="items" />;
  },
}));
vi.mock('@commercetools-demo/puck-theme-manager', () => ({
  ThemeManager: (props: Record<string, unknown>) => {
    seen.theme = props;
    return <div data-testid="theme" />;
  },
}));
vi.mock('./puck-config', () => ({ portalPuckConfig: { components: {} } }));

import { ContentoolsWrapper, type ContentoolsWrapperProps } from './ContentoolsWrapper';

const base: ContentoolsWrapperProps = { tab: 'theme', parentUrl: '/de-DE/store/theme', locale: 'de-DE', storeKey: 'store-a', connected: true, projectKey: 'proj' };
const show = (props: Partial<ContentoolsWrapperProps> = {}) => renderWithProviders(<ContentoolsWrapper {...base} {...props} />, { locale: 'en-US', messages: en });

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  for (const key of Object.keys(seen)) delete seen[key];
});
afterEach(() => vi.useRealTimers());

describe('ContentoolsWrapper', () => {
  it('no store shows pick a store, no managers mounted', async () => {
    show({ storeKey: null });
    expect(screen.getByText('Pick a store to edit its storefront.')).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(Object.keys(seen)).toEqual([]);
  });

  it('not connected shows the exact message', async () => {
    show({ connected: false });
    expect(screen.getByRole('alert').textContent).toBe("Contentools isn't connected — install the Merchant Center app and click Connect");
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(Object.keys(seen)).toEqual([]);
  });

  it('shows a spinner first, then the manager after the delay', async () => {
    show();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByTestId('theme')).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(await screen.findByTestId('theme')).toBeTruthy();
  });

  it.each([['theme'], ['pages'], ['items']] as const)('managers get an absolute baseURL ending in /api/contentools/service, businessUnitKey equals storeKey, jwtToken is the placeholder (%s)', async (tab) => {
    show({ tab, parentUrl: `/de-DE/x/${tab}` });
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    await screen.findByTestId(tab);
    const props = seen[tab];
    expect(props.baseURL).toBe(`${window.location.origin}/api/contentools/service`);
    expect(String(props.baseURL)).toMatch(/^https?:\/\//);
    expect(props.businessUnitKey).toBe('store-a');
    expect(props.projectKey).toBe('proj');
    expect(props.jwtToken).toBe('server-managed');
    expect(props.locale).toBe('de-DE');
    if (tab !== 'theme') {
      expect(props.parentUrl).toBe(`/de-DE/x/${tab}`);
      expect(props.config).toBeDefined();
    }
  });
});

describe('a11y: ContentoolsWrapper states', () => {
  it('the pick-a-store and not-connected states have no axe violations and announce through role=alert', async () => {
    const a = show({ storeKey: null });
    expect(await axe(a.container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
    a.unmount();
    const b = show({ connected: false });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(await axe(b.container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });

  it('every message shown inside the always-light editor surface uses an absolute text colour, not a theme token (dark portal theme)', () => {
    for (const props of [{ storeKey: null }, { connected: false }, {}]) {
      const view = show(props);
      const message = screen.getByText(/Pick a store|Contentools isn't connected|Loading the editor/);
      expect(message.className).toContain('text-gray-15');
      expect(message.className).not.toMatch(/text-text\b/);
      view.unmount();
    }
  });
});
