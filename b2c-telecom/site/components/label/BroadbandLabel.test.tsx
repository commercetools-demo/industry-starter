import { readFileSync } from 'node:fs';
import path from 'node:path';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { BroadbandLabel } from './BroadbandLabel';
import { SAMPLE_LABEL } from './__fixtures__/label';

describe('BroadbandLabel', () => {
  it('Label in the bundle: monthly price, price-lock note, one-time fees, early-termination fee, speeds, data and a unique plan ID', () => {
    renderWithProviders(<BroadbandLabel label={SAMPLE_LABEL} />);
    const label = screen.getByRole('article', { name: 'Broadband Facts: Cable 500' });
    for (const text of ['Malva Telecom', 'Cable internet', '$59.99', 'Price locked for 24 months.', 'Activation fee', '$25.00', '$10 x months remaining', 'Varies by location', '525 Mbps', '48 Mbps', '13 ms', 'Unlimited']) {
      expect(label).toHaveTextContent(text);
    }
    expect(label).toHaveTextContent('Learn more about the terms used on this label at fcc.gov/consumer. Unique plan ID: MLV-CBL-500-24M');
    expect(label).toHaveAttribute('data-plan-id', 'MLV-CBL-500-24M');
  });

  it('renders every section in the order of the spec', () => {
    renderWithProviders(<BroadbandLabel label={SAMPLE_LABEL} />);
    const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);
    expect(headings).toEqual([
      'Broadband Facts',
      'Monthly Price',
      'Provider Monthly Fees',
      'One-time Fees at the Time of Purchase',
      'Other Fees',
      'Discounts & Bundles',
      'Speeds Provided with Plan',
      'Data Included with Monthly Price',
      'Network Management & Privacy',
      'Customer Support',
    ]);
    expect(screen.getByText('Charges for additional data usage: None')).toBeInTheDocument();
  });

  it('the label text is English in de-DE too', () => {
    renderWithProviders(<BroadbandLabel label={SAMPLE_LABEL} />, { locale: 'de-DE' });
    expect(screen.getByRole('heading', { name: 'Broadband Facts' })).toBeInTheDocument();
    expect(screen.getByText('Speeds Provided with Plan')).toBeInTheDocument();
  });

  it('shows no empty monthly-fees list when the plan has none', () => {
    renderWithProviders(<BroadbandLabel label={{ ...SAMPLE_LABEL, monthlyFees: [] }} />);
    expect(screen.queryByText('Router rental')).not.toBeInTheDocument();
  });

  it('Brand styling does not alter the label: black on white, 2px border, Roboto, no token references', () => {
    const css = readFileSync(path.join(__dirname, 'BroadbandLabel.module.css'), 'utf8');
    expect(css).toContain('border: 2px solid #000');
    expect(css).toContain('font-family: Roboto');
    expect(css).toContain('color: #000');
    expect(css).toContain('background: #fff');
    expect(css).toContain('border-radius: 0');
    expect(css).not.toContain('var(--');
    // the rule hierarchy: 8px, 4px, 1px, 2px
    for (const rule of ['border-top: 8px solid #000', 'border-top: 4px solid #000', 'border-top: 1px solid #000', 'border-top: 2px solid #000']) expect(css).toContain(rule);
    // the component itself reads no token class either
    const source = readFileSync(path.join(__dirname, 'BroadbandLabel.tsx'), 'utf8');
    expect(source).not.toMatch(/\b(?:bg|text|border)-(?:brand|pink|neutral|surface|text)-/);
  });
});
