import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Card from './Card';

describe('Card', () => {
  it('Card renders as the chosen element', () => {
    const { rerender } = render(<Card data-testid="c">x</Card>);
    expect(screen.getByTestId('c').tagName).toBe('DIV');
    rerender(
      <Card as="article" data-testid="c">
        x
      </Card>,
    );
    expect(screen.getByTestId('c').tagName).toBe('ARTICLE');
    expect(screen.getByTestId('c').className).toContain('rounded-card');
  });
});
