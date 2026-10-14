/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailPage } from '@/components/email/EmailPage';
import { ToastProvider } from '@/context/ToastContext';
import { ViewerProvider } from '@/context/ViewerContext';
import type { Viewer } from '@/lib/portal/types';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

const t = (s: string) => ({ 'de-DE': s, 'en-US': s });
const tpl = (key: string, over: Record<string, unknown> = {}) => ({ key, subject: t('Your order {{order_number}} is confirmed'), body: t('Hello {{customer_name}}'), enabled: true, stored: true, ...over });

const state = vi.hoisted(() => ({
  templates: { templates: [] as unknown[], events: [] as unknown[], brand: { primary: '#112233', logoUrl: null as string | null, storeName: 'Store A' } },
  campaigns: [] as unknown[],
  save: vi.fn(),
  preview: vi.fn(),
  suggest: vi.fn(),
  createCampaign: vi.fn(),
  markReady: vi.fn(),
  mutate: vi.fn(async () => undefined),
}));

vi.mock('@/hooks/marketingApi', () => ({
  useEmailTemplates: () => ({ data: state.templates, error: undefined, mutate: state.mutate }),
  useEmailCampaigns: () => ({ data: { campaigns: state.campaigns }, error: undefined, mutate: state.mutate }),
  emailApi: {
    save: (...a: unknown[]) => state.save(...a),
    preview: (...a: unknown[]) => state.preview(...a),
    suggest: (...a: unknown[]) => state.suggest(...a),
    createCampaign: (...a: unknown[]) => state.createCampaign(...a),
    markReady: (...a: unknown[]) => state.markReady(...a),
  },
}));

const viewer: Viewer = { customerId: 'c1', name: 'N T', email: 'n@example.com', roles: ['admin'], ctPermissions: [], businessUnitKey: 'bu-1', businessUnitName: 'Garage Nord', storeKey: 'store-a', storeName: 'DACH Online' };

function screenOf(ui: ReactNode) {
  return renderWithProviders(
    <ViewerProvider viewer={viewer}>
      <ToastProvider>{ui}</ToastProvider>
    </ViewerProvider>,
    { locale: 'en-US', messages: en },
  );
}

const previewOk = (over: Record<string, unknown> = {}) => ({ ok: true, status: 200, data: { subject: t('Your order MO-482913 is confirmed'), html: t('Hello Alex Muster'), brand: state.templates.brand, ...over } });

beforeEach(() => {
  state.templates = {
    templates: [tpl('order-confirmation'), tpl('shipment-update', { stored: false }), tpl('win-back', { enabled: false })],
    events: [
      { id: 'order-placed', template: 'order-confirmation', state: 'stored-not-sent' },
      { id: 'order-shipped', template: 'shipment-update', state: 'not-set-up' },
      { id: 'order-delivered', template: null, state: 'not-set-up' },
    ],
    brand: { primary: '#112233', logoUrl: null, storeName: 'Store A' },
  };
  state.campaigns = [];
  for (const fn of [state.save, state.preview, state.suggest, state.createCampaign, state.markReady]) fn.mockReset();
  state.preview.mockResolvedValue(previewOk());
  state.save.mockResolvedValue({ ok: true, status: 200, data: {} });
});

describe('transactional event states', () => {
  it('an enabled stored template shows "Stored, not sent", none shows "Not set up", and the word Live never appears', async () => {
    const { container } = screenOf(<EmailPage />);
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Order placed');
    expect(rows[1]).toHaveTextContent('Stored, not sent');
    expect(rows[2]).toHaveTextContent('Not set up');
    expect(rows[3]).toHaveTextContent('Order delivered');
    expect(rows[3]).toHaveTextContent('Not set up');
    expect(container.textContent).not.toMatch(/\bLive\b/);
    expect(container.textContent).not.toMatch(/Last sent/);
    await screen.findByText('MO-482913', { exact: false });
  });

  it('says that sending is not connected', async () => {
    screenOf(<EmailPage />);
    expect(screen.getByText('E-mail sending is not connected in this release; templates are stored only.')).toBeVisible();
    expect(screen.getByText('E-mail sending is not connected in this release.')).toBeVisible();
    await screen.findByText('MO-482913', { exact: false });
  });
});

describe('TemplateEditor', () => {
  it('saving an unknown variable shows an error naming it', async () => {
    state.save.mockResolvedValue({ ok: false, status: 400, data: null, code: 'UNKNOWN_VARIABLE', details: { variable: 'foo' } });
    screenOf(<EmailPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Save template' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unknown variable foo');
    expect(state.save).toHaveBeenCalledWith('store-a', 'order-confirmation', expect.objectContaining({ enabled: true }));
  });

  it('the preview shows the sample order from the server and the logo only when the store has one', async () => {
    const first = screenOf(<EmailPage />);
    expect(await screen.findByText('Your order MO-482913 is confirmed')).toBeVisible();
    expect(screen.queryByRole('img')).toBeNull();
    first.unmount();
    state.templates.brand = { primary: '#112233', logoUrl: 'https://images.example.test/logo.png', storeName: 'Store A' };
    state.preview.mockResolvedValue(previewOk({ brand: state.templates.brand }));
    screenOf(<EmailPage />);
    expect(await screen.findByRole('img', { name: 'Store A logo' })).toHaveAttribute('src', 'https://images.example.test/logo.png');
  });

  it('the preview text is never injected as HTML: entities become text', async () => {
    state.preview.mockResolvedValue(previewOk({ html: t('Hi &lt;script&gt;x&lt;/script&gt;<br>Next') }));
    const { container } = screenOf(<EmailPage />);
    await screen.findByText('Hi <script>x</script>', { exact: false });
    expect(container.querySelector('script')).toBeNull();
  });

  it('Insert variable puts {{order_number}} into the focused field', async () => {
    screenOf(<EmailPage />);
    const subject = screen.getByLabelText('Subject');
    await userEvent.clear(subject);
    await userEvent.click(subject);
    await userEvent.click(screen.getByRole('button', { name: 'Insert {{order_number}}' }));
    expect(subject).toHaveValue('{{order_number}}');
    await screen.findByText('MO-482913', { exact: false });
  });
});

describe('AudienceCampaigns', () => {
  const open = async () => {
    screenOf(<EmailPage initialTab="campaigns" />);
  };

  it('shows the suggestion card and stores nothing until Use rule is pressed', async () => {
    state.suggest.mockResolvedValue({ ok: true, status: 200, data: { ok: true, rule: { all: [{ type: 'registered' }] }, text: 'bought Brake discs and did not buy Pads', count: 27 } });
    state.createCampaign.mockResolvedValue({ ok: true, status: 201, data: {} });
    await open();
    await userEvent.type(screen.getByLabelText('Campaign name'), 'TST-W discs');
    await userEvent.type(screen.getByLabelText('Describe the audience'), 'Customers who bought brake discs but not pads');
    await userEvent.click(screen.getByRole('button', { name: 'Suggest rule' }));
    expect(await screen.findByText('Rule: bought Brake discs and did not buy Pads — 27 customers')).toBeVisible();
    expect(state.createCampaign).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Use rule' }));
    await waitFor(() => expect(state.createCampaign).toHaveBeenCalledWith('store-a', { name: 'TST-W discs', templateKey: 'win-back', rule: { all: [{ type: 'registered' }] } }));
  });

  it('an unknown phrase shows the hint and the categories', async () => {
    state.suggest.mockResolvedValue({ ok: true, status: 200, data: { ok: false, hint: 'Try: customers who bought <category> but not <category>', categories: ['Brakes', 'Filters'] } });
    await open();
    await userEvent.type(screen.getByLabelText('Describe the audience'), 'people with red cars');
    await userEvent.click(screen.getByRole('button', { name: 'Suggest rule' }));
    expect(await screen.findByText('Try: customers who bought <category> but not <category>')).toBeVisible();
    expect(screen.getByText('Filters')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Use rule' })).toBeNull();
  });

  it('Send is disabled with the explanation, a draft can be marked ready', async () => {
    state.campaigns = [{ id: 'c1', name: 'TST-W discs', templateKey: 'win-back', ruleText: 'bought Brake discs', status: 'Draft', recipientCount: null, openRate: null }];
    state.markReady.mockResolvedValue({ ok: true, status: 200, data: {} });
    await open();
    const send = screen.getByRole('button', { name: 'Send' });
    expect(send).toBeDisabled();
    expect(screen.getByText('Sending is not connected in this release')).toBeVisible();
    expect(send).toHaveAccessibleDescription('Sending is not connected in this release');
    await userEvent.click(screen.getByRole('button', { name: 'Mark ready' }));
    expect(state.markReady).toHaveBeenCalledWith('store-a', 'c1');
  });
});

describe('accessibility', () => {
  it('the Templates and Campaigns tabs have no violations', async () => {
    const templates = screenOf(<EmailPage />);
    await screen.findByText('MO-482913', { exact: false });
    expect(await axe(templates.container)).toHaveNoViolations();
    templates.unmount();
    state.campaigns = [{ id: 'c1', name: 'TST-W discs', templateKey: 'win-back', ruleText: 'bought Brake discs', status: 'Ready', recipientCount: 12, openRate: null }];
    const campaigns = screenOf(<EmailPage initialTab="campaigns" />);
    expect(await axe(campaigns.container)).toHaveNoViolations();
  });
});
