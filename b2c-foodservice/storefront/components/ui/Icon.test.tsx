import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/cn';
import { sourceFiles } from '@/test/css';
import Icon from './Icon';
import IconButton from './IconButton';
import { ICONS } from './icons';

const names = Object.keys(ICONS) as Array<keyof typeof ICONS>;

describe('Icon set', () => {
  it('New glyph: every icon renders a 24px viewBox, 1.75 stroke, round caps and joins', () => {
    for (const name of names) {
      const { container, unmount } = render(<Icon name={name} />);
      const svg = container.querySelector('svg') as SVGSVGElement;
      expect(svg.getAttribute('viewBox'), name).toBe('0 0 24 24');
      expect(svg.getAttribute('stroke-width'), name).toBe('1.75');
      expect(svg.getAttribute('stroke-linecap'), name).toBe('round');
      expect(svg.getAttribute('stroke-linejoin'), name).toBe('round');
      expect(svg.querySelectorAll('path').length, name).toBeGreaterThan(0);
      unmount();
    }
  });

  it('New glyph: cup, bean, capsule and machine exist', () => {
    for (const name of ['cup', 'bean', 'capsule', 'machine']) expect(names).toContain(name);
  });

  it('Icon paths use only drawing commands M L H V C S Q T A Z', () => {
    for (const name of names) {
      for (const d of ICONS[name]) {
        expect(d, `${name}: ${d}`).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9\s.,-]+$/);
        expect(d.trim()[0], name).toMatch(/[Mm]/);
      }
    }
  });

  it('No emoji in the icon set or in components', () => {
    const emoji = /\p{Extended_Pictographic}/u;
    const files = [...sourceFiles('components'), ...sourceFiles('app'), 'components/ui/icons.ts'];
    for (const file of files) {
      expect(readFileSync(join(process.cwd(), file), 'utf8'), file).not.toMatch(emoji);
    }
  });

  it('Icon with a title is exposed as an image', () => {
    render(<Icon name="check" title="Done" />);
    expect(screen.getByRole('img', { name: 'Done' })).toBeInTheDocument();
  });

  it('Decorative icons are aria-hidden', () => {
    const { container } = render(<Icon name="check" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('Icon button', () => {
  it('Icon button: an icon-only control has an accessible name', () => {
    render(<IconButton label="Cart" icon="bag" />);
    expect(screen.getByRole('button', { name: 'Cart' })).toBeInTheDocument();
  });

  it('Icon button: decorative icons are aria-hidden', () => {
    render(<IconButton label="Cart" icon="bag" badgeCount={3} />);
    const button = screen.getByRole('button', { name: 'Cart' });
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('Icon button shows a cart count only when above zero', () => {
    const { rerender } = render(<IconButton label="Cart" icon="bag" badgeCount={3} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    rerender(<IconButton label="Cart" icon="bag" badgeCount={0} />);
    expect(screen.queryByText('0')).toBeNull();
  });
});

describe('cn', () => {
  it('cn drops falsy parts', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
  });
});
