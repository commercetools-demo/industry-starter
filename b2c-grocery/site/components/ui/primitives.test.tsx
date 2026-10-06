import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Heart } from 'lucide-react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Container } from '@/components/layout/Container';
import { renderWithProviders } from '@/test/utils';
import { Blob } from './Blob';
import { Button } from './Button';
import { Card, CardKicker, CardMeta, CardTitle } from './Card';
import { Icon } from './Icon';
import { Tag } from './Tag';

describe('breakpoints', () => {
  it('globals.css defines the tablet (768) and desktop (1200) breakpoints', () => {
    const css = readFileSync(path.resolve(__dirname, '../../app/globals.css'), 'utf8');
    expect(css).toContain('--breakpoint-tablet: 48rem');
    expect(css).toContain('--breakpoint-desktop: 75rem');
  });
});

describe('Icon', () => {
  it('is decorative with stroke width 2.75 and the given size', () => {
    const { container } = render(<Icon icon={Heart} size={20} />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('stroke-width', '2.75');
    expect(svg).toHaveAttribute('width', '20');
  });
});

describe('Button', () => {
  it.each([
    ['primary', 'btn btn-primary'],
    ['secondary', 'btn btn-secondary'],
    ['ghost', 'btn btn-ghost'],
  ] as const)('variant %s maps to its class', (variant, classes) => {
    render(<Button variant={variant}>Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass(...classes.split(' '));
  });

  it('size icon and block add their classes', () => {
    render(
      <Button variant="secondary" size="icon" block>
        X
      </Button>,
    );
    expect(screen.getByRole('button')).toHaveClass('btn-icon', 'btn-block');
  });

  it('renders a locale-aware link when href is given', () => {
    renderWithProviders(<Button href="/shop">Shop</Button>, { locale: 'de-DE' });
    const link = screen.getByRole('link', { name: 'Shop' });
    expect(link).toHaveAttribute('href', '/de-DE/shop');
    expect(link).toHaveClass('btn', 'btn-primary');
  });

  it('Disabled control: has the disabled attribute and ignores clicks', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Buy
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Buy' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('defaults to type=button and calls onClick when enabled', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Ok</Button>);
    const button = screen.getByRole('button', { name: 'Ok' });
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Tag', () => {
  it.each(['accent', 'accent-2', 'neutral', 'outline'] as const)('tone %s maps to its class', (tone) => {
    render(<Tag tone={tone}>t</Tag>);
    expect(screen.getByText('t')).toHaveClass('tag', `tag-${tone}`);
  });
});

describe('Blob', () => {
  it('is hidden from assistive technology', () => {
    const { container } = render(<Blob />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.firstElementChild).toHaveClass('blob');
  });
});

describe('Container', () => {
  it('applies the .page class', () => {
    render(<Container>content</Container>);
    expect(screen.getByText('content')).toHaveClass('page');
  });
});

describe('Card', () => {
  it('applies the elevation and renders its parts', () => {
    render(
      <Card elev="lg" data-testid="card">
        <CardKicker>Kick</CardKicker>
        <CardTitle>Title</CardTitle>
        <CardMeta>Meta</CardMeta>
      </Card>,
    );
    expect(screen.getByTestId('card')).toHaveClass('card', 'elev-lg');
    expect(screen.getByText('Kick')).toHaveClass('card-kicker');
    expect(screen.getByText('Title')).toHaveClass('card-title');
    expect(screen.getByText('Meta')).toHaveClass('card-meta');
  });
});
