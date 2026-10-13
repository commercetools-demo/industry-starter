import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Chip as CatalogChip } from '@/components/catalog/Chip';
import { Chip } from './Chip';

const TONES = ['success', 'info', 'neutral', 'warning', 'critical'] as const;

describe('status chips have text', () => {
  for (const [name, Component] of [['portal', Chip], ['catalog', CatalogChip]] as const) {
    it(`${name} chip: every tone shows its status as text (colour is never the only cue), the dot is decorative, no axe violations`, async () => {
      const { container } = render(
        <ul>
          {TONES.map((tone) => (
            <li key={tone}>
              <Component tone={tone}>{`Status ${tone}`}</Component>
            </li>
          ))}
        </ul>,
      );
      for (const tone of TONES) expect(screen.getByText(`Status ${tone}`)).toBeVisible();
      for (const dot of container.querySelectorAll('[aria-hidden="true"]')) expect(dot).toBeEmptyDOMElement();
      expect(await axe(container)).toHaveNoViolations();
    });
  }
});
