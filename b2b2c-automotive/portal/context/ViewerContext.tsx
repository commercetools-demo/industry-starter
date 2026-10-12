'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Viewer } from '@/lib/portal/types';

const ViewerContext = createContext<Viewer | null>(null);

/** The signed-in associate, resolved on the server by the (portal) layout. */
export function ViewerProvider({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

export function useViewer(): Viewer {
  const viewer = useContext(ViewerContext);
  if (!viewer) throw new Error('useViewer needs ViewerProvider');
  return viewer;
}
