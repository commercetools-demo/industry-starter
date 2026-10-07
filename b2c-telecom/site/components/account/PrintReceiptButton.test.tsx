import { readFileSync } from 'node:fs';
import path from 'node:path';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { PrintReceiptButton } from './PrintReceiptButton';

describe('PrintReceiptButton', () => {
  it('opens the print dialog and is itself hidden on paper', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    renderWithProviders(<PrintReceiptButton />);
    const button = screen.getByRole('button', { name: 'Print receipt' });
    expect(button).toHaveAttribute('data-print', 'hide');
    await userEvent.click(button);
    expect(print).toHaveBeenCalledTimes(1);
  });
});

describe('receipt.css', () => {
  const css = readFileSync(path.join(__dirname, 'receipt.css'), 'utf8');
  const printBlock = css.slice(css.indexOf('@media print'));

  it('hides [data-print="hide"] elements, the site header and the site footer on paper only', () => {
    expect(css.slice(0, css.indexOf('@media print'))).not.toContain('display: none !important');
    expect(printBlock).toMatch(/\[data-print='hide'\][\s\S]*display:\s*none\s*!important/);
    expect(printBlock).toContain('body > div > header');
    expect(printBlock).toContain('body > div > footer');
  });

  it('sets the receipt in black on white from tokens, without raw colours or pixel values', () => {
    expect(printBlock).toContain('color: var(--color-neutral-900)');
    expect(printBlock).toContain('background: var(--color-neutral-0)');
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\b\d+px\b/);
  });

  it('shows the receipt heading only on paper', () => {
    expect(css).toMatch(/\.receipt-only\s*{\s*display:\s*none;/);
    expect(printBlock).toMatch(/\.receipt-only\s*{\s*display:\s*block;/);
  });
});
