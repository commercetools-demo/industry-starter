import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { readCss, rootTokens } from '@/test/css';
import ColorSwatch, { swatchBackground } from './ColorSwatch';

const tokens = rootTokens(readCss('app/tokens.css'));

describe('ColorSwatch', () => {
  it('Colour swatch uses the swatch token and falls back for unknown colours', () => {
    expect(swatchBackground('red')).toBe('var(--swatch-red, var(--swatch-fallback))');
    expect(tokens).toHaveProperty(['--swatch-red']);
    // an unknown key has no token, so the var() fallback applies
    expect(tokens).not.toHaveProperty(['--swatch-mauve']);
    expect(swatchBackground('mauve')).toContain('var(--swatch-fallback)');
    // keys that are not safe token suffixes go straight to the fallback token
    expect(swatchBackground('red; background: url(x)')).toBe('var(--swatch-fallback, var(--swatch-fallback))');
    render(<ColorSwatch colour="red" label="Red" />);
    expect(screen.getByRole('img', { name: 'Red' }).getAttribute('style')).toContain('--swatch-red');
  });

  it('Colour swatch selected has the double ring', () => {
    render(<ColorSwatch colour="black" label="Black" selected size="lg" />);
    const el = screen.getByRole('img', { name: 'Black' });
    expect(el.className).toContain('var(--canvas)');
    expect(el.className).toContain('var(--ink)');
    expect(el.className).toContain('h-[42px]');
  });

  it('Colour swatch is 14px on cards', () => {
    render(<ColorSwatch colour="cream" label="Cream" />);
    expect(screen.getByRole('img', { name: 'Cream' }).className).toContain('h-[14px]');
  });

  it('Colour swatch as a button has an accessible name', async () => {
    const onSelect = vi.fn();
    render(<ColorSwatch colour="silver" label="Silver" onSelect={onSelect} selected />);
    const b = screen.getByRole('button', { name: 'Silver' });
    expect(b).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(b);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
