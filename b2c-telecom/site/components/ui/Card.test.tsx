import { render, screen } from '@testing-library/react';
import { Card, CardBody, CardHeader } from './Card';

describe('Card', () => {
  it('maps header tones to classes and renders the body', () => {
    render(
      <>
        <Card as="article">
          <CardHeader tone="brand">brand</CardHeader>
          <CardBody>body</CardBody>
        </Card>
        <CardHeader tone="pink">pink</CardHeader>
        <CardHeader>plain</CardHeader>
      </>,
    );
    expect(screen.getByText('brand')).toHaveClass('bg-brand-500', 'text-text-on-brand', 'p-7');
    expect(screen.getByText('pink')).toHaveClass('bg-pink-900');
    expect(screen.getByText('plain')).toHaveClass('bg-surface');
    expect(screen.getByText('body')).toHaveClass('flex', 'flex-col', 'gap-5', 'p-7');
    expect(screen.getByRole('article')).toHaveClass('rounded-xl', 'border-border');
  });
});
