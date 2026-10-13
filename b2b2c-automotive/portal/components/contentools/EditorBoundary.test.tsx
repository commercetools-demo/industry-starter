// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';
import { EditorBoundary } from './EditorBoundary';
import { UNSUPPORTED_PRESET_KEYS } from './theme-support';

const SUFFIX = ' (Not supported on your storefront)';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const PresetSelect = () => (
  <select id="theme-preset-select" defaultValue="">
    <option value="">Choose</option>
    <option value="flat">Flat</option>
    <option value="neumorphism">Neumorphism</option>
    <option value="glassmorphism">Glassmorphism</option>
    <option value="material">Material</option>
  </select>
);

describe('EditorBoundary', () => {
  it('unsupported preset options get disabled and suffixed', async () => {
    renderWithProviders(
      <EditorBoundary presets>
        <PresetSelect />
      </EditorBoundary>,
      { locale: 'en-US', messages: en },
    );
    const option = (value: string) => document.querySelector<HTMLOptionElement>(`#theme-preset-select option[value="${value}"]`)!;
    for (const key of ['neumorphism', 'glassmorphism']) {
      expect(UNSUPPORTED_PRESET_KEYS).toContain(key);
      expect(option(key).disabled).toBe(true);
      expect(option(key).text.endsWith(SUFFIX)).toBe(true);
    }
    expect(option('flat').disabled).toBe(false);
    expect(option('flat').text).toBe('Flat');
    expect(option('material').text).toBe('Material');
  });

  it('marks a select that appears later', async () => {
    const { rerender } = renderWithProviders(<EditorBoundary presets>{null}</EditorBoundary>, { locale: 'en-US', messages: en });
    rerender(
      <EditorBoundary presets>
        <PresetSelect />
      </EditorBoundary>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.querySelector<HTMLOptionElement>('option[value="neumorphism"]')!.disabled).toBe(true);
  });

  it('missing select shows the static notice after 3 s', () => {
    renderWithProviders(<EditorBoundary presets>{null}</EditorBoundary>, { locale: 'en-US', messages: en });
    expect(screen.queryByRole('note')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(3001);
    });
    expect(screen.getByRole('note').textContent).toContain('neumorphism');
  });

  it('is a light scope with a definite height, and shows no notice without presets', () => {
    renderWithProviders(
      <EditorBoundary>
        <p>child</p>
      </EditorBoundary>,
      { locale: 'en-US', messages: en },
    );
    const box = screen.getByText('child').parentElement!;
    expect(box.getAttribute('data-theme')).toBe('light');
    expect(box.style.minHeight).toContain('100vh');
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('a11y: editor chrome around the Contentools managers', () => {
  it('adds no focus trap and no tab stop of its own, so the editors can be left with Tab and Shift+Tab (K14)', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const { container } = renderWithProviders(
      <>
        <button type="button">before</button>
        <EditorBoundary>
          <button type="button">inside</button>
        </EditorBoundary>
        <button type="button">after</button>
      </>,
      { locale: 'en-US', messages: en },
    );
    await user.tab();
    expect(screen.getByText('before')).toHaveFocus();
    await user.tab();
    expect(screen.getByText('inside')).toHaveFocus();
    await user.tab();
    expect(screen.getByText('after')).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByText('inside')).toHaveFocus();
    expect(container.querySelector('[data-theme="light"]')).not.toHaveAttribute('tabindex');
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });
});
