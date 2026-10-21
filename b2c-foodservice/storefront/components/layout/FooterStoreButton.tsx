'use client';

import { useCollectionStore } from '@/hooks/useCollectionStore';

/** Footer "Choose your store": opens the store picker from the header context (no product, no availability lines). */
export default function FooterStoreButton({ label, className }: { label: string; className?: string }) {
  const { open } = useCollectionStore();
  return (
    <button type="button" onClick={() => open()} className={className}>
      {label}
    </button>
  );
}
