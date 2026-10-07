import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { Chip } from './Chip';

describe('Chip', () => {
  it('aria-pressed follows selected and the look changes', () => {
    renderWithProviders(
      <>
        <Chip selected={false} onClick={() => undefined}>
          Off
        </Chip>
        <Chip selected onClick={() => undefined}>
          On
        </Chip>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Off' })).toHaveClass('bg-brand-100');
    expect(screen.getByRole('button', { name: 'On' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'On' })).toHaveClass('bg-brand-950');
  });

  it('calls onClick once per click', () => {
    const onClick = vi.fn();
    renderWithProviders(
      <Chip selected={false} onClick={onClick}>
        Music
      </Chip>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Music' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders the count', () => {
    renderWithProviders(
      <Chip selected={false} count={3} onClick={() => undefined}>
        Video
      </Chip>,
    );
    expect(screen.getByRole('button', { name: 'Video 3' })).toBeInTheDocument();
  });
});
