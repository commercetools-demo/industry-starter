'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { useCollectionStore } from '@/hooks/useCollectionStore';

/** Developer harness (not user-facing, English only on purpose; deleted in workstream Q). */
export default function Harness() {
  const { open, store, preferShip } = useCollectionStore();
  const [sku, setSku] = useState('');
  return (
    <div className="wrap py-10">
      <h1 className="page-title m-0 mb-6">Store picker harness</h1>
      <p className="mb-4">
        Chosen store: <strong data-testid="chosen">{store?.key ?? 'none'}</strong>. preferShip:{' '}
        <strong data-testid="prefer-ship">{String(preferShip)}</strong>
      </p>
      <div className="flex max-w-[520px] flex-col gap-3">
        <Button type="button" onClick={() => open()}>
          Open from the header (no availability)
        </Button>
        <div className="flex gap-2">
          <Input
            aria-label="SKU"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="a seeded SKU"
            shape="pill"
          />
          <Button type="button" variant="accent" onClick={() => open({ sku })} disabled={!sku}>
            Open for SKU
          </Button>
        </div>
      </div>
    </div>
  );
}
