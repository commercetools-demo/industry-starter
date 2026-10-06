'use client';

export interface UseSaved {
  isSaved(productId: string): boolean;
  toggle(productId: string): Promise<void>;
}

/** Stub until workstream T (saved lists) replaces it; the interface is final. */
export function useSaved(): UseSaved {
  return { isSaved: () => false, toggle: async () => {} };
}
