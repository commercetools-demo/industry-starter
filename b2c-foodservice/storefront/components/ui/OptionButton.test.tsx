import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import OptionButton from './OptionButton';

describe('OptionButton', () => {
  it('Disabled option explains itself: struck through, not selectable, carries a title', async () => {
    const onClick = vi.fn();
    render(
      <OptionButton disabled disabledReason="Not available for collection" onClick={onClick}>
        250 g
      </OptionButton>,
    );
    const b = screen.getByRole('button', { name: '250 g' });
    expect(b.className).toContain('line-through');
    expect(b).toHaveAttribute('aria-disabled', 'true');
    expect(b).toHaveAttribute('title', 'Not available for collection');
    await userEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('Disabled option is still focusable', async () => {
    render(
      <OptionButton disabled disabledReason="Sold out">
        1 kg
      </OptionButton>,
    );
    await userEvent.tab();
    expect(screen.getByRole('button', { name: '1 kg' })).toHaveFocus();
  });

  it('TypeScript refuses a disabled option without a reason', () => {
    // The assertion is the compiler: `npm run typecheck` fails if the directive below becomes unused.
    const element = (
      // @ts-expect-error disabled requires disabledReason
      <OptionButton disabled>x</OptionButton>
    );
    expect(element).toBeTruthy();
  });

  it('Selected option uses the ink fill and aria-pressed', async () => {
    const onClick = vi.fn();
    render(
      <OptionButton selected onClick={onClick}>
        250 g
      </OptionButton>,
    );
    const b = screen.getByRole('button', { name: '250 g' });
    expect(b).toHaveAttribute('aria-pressed', 'true');
    expect(b.className).toContain('bg-ink');
    await userEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('An unselected enabled option has no title', () => {
    render(<OptionButton>250 g</OptionButton>);
    const b = screen.getByRole('button', { name: '250 g' });
    expect(b).toHaveAttribute('aria-pressed', 'false');
    expect(b).not.toHaveAttribute('title');
  });
});
