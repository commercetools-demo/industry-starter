'use client';

import type { ReactNode } from 'react';
import AssistantPanel from '@/components/assistant/AssistantPanel';
import { AssistantProvider } from '@/context/assistant-context';

/** The provider first (so the header launcher is a descendant) and the one panel per layout. `enabled` comes from a server component. */
export default function AssistantRoot({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return (
    <AssistantProvider enabled={enabled}>
      {children}
      <AssistantPanel />
    </AssistantProvider>
  );
}
