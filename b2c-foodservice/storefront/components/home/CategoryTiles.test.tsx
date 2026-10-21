import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { category, TREE } from '@/components/home/home-fixtures';
import { expectNoAxeViolations } from '@/test/axe';
import { renderShell } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import CategoryTiles from '@/components/home/CategoryTiles';

const names = () => screen.getAllByTestId('category-tile').map((a) => a.textContent);

describe('CategoryTiles', () => {
  it('Tile order: tiles follow the configured order capped at four', () => {
    renderShell(<CategoryTiles tree={TREE} keys={['mcf-cat-machines', 'mcf-cat-pods', 'mcf-cat-gifts', 'mcf-cat-coffee']} />);
    expect(names()).toEqual(['Machines', 'Pods', 'Gifts', 'Coffee']);
  });

  it('five configured keys render four tiles', () => {
    renderShell(<CategoryTiles tree={TREE} keys={TREE.map((c) => c.key as string)} />);
    expect(names()).toHaveLength(4);
  });

  it('unknown category key is skipped', () => {
    renderShell(<CategoryTiles tree={TREE} keys={['mcf-cat-nope', 'mcf-cat-coffee']} />);
    expect(names()).toEqual(['Coffee']);
  });

  it('a tree with no matching category renders nothing', () => {
    const { container } = renderShell(<CategoryTiles tree={[]} />);
    expect(container.querySelector('section')).toBeNull();
  });

  it('a nested category can be a tile', () => {
    const tree = [{ ...category('mcf-cat-pods', 'pods', 'Pods'), children: [category('mcf-cat-pods-original', 'pods-original', 'Original')] }];
    renderShell(<CategoryTiles tree={tree} keys={['mcf-cat-pods-original']} />);
    expect(names()).toEqual(['Original']);
  });

  it('tile is a link to the category listing', () => {
    renderShell(<CategoryTiles tree={TREE} keys={['mcf-cat-coffee']} />);
    expect(screen.getByRole('link', { name: 'Coffee' })).toHaveAttribute('href', '/category/coffee');
  });

  it('missing image shows the placeholder', () => {
    renderShell(<CategoryTiles tree={TREE} keys={['mcf-cat-pods', 'mcf-cat-coffee']} />);
    expect(screen.getAllByTestId('tile-placeholder')).toHaveLength(1);
    expect(document.querySelectorAll('img')).toHaveLength(1);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderShell(<CategoryTiles tree={TREE} />);
    await expectNoAxeViolations(container);
  });
});
