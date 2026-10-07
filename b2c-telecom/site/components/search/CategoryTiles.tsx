import type { ReactElement } from 'react';
import { Button } from '@/components/ui/Button';
import type { CategoryTile } from '@/lib/search/tiles';

/** Links to the curated categories (the same URLs as the header): the way out of an empty or start state. */
export function CategoryTiles({ tiles, label }: { tiles: CategoryTile[]; label: string }): ReactElement | null {
  if (tiles.length === 0) return null;
  return (
    <nav aria-label={label}>
      <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
        {tiles.map((tile) => (
          <li key={tile.key}>
            <Button href={tile.href} variant="secondary" size="sm">
              {tile.name}
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
