'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { CommandPalette, useCommandPaletteShortcut } from '@/components/portal/CommandPalette';
import { CopilotPanel } from '@/components/portal/CopilotPanel';
import { CustomerSessionBanner } from '@/components/portal/CustomerSessionBanner';
import { OverlayProvider } from '@/context/OverlayContext';
import { PaletteProvider } from '@/context/PaletteContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { ViewerProvider } from '@/context/ViewerContext';
import { usePermissions } from '@/hooks/usePermissions';
import type { Viewer } from '@/lib/portal/types';
import { MobileDrawer } from './MobileDrawer';
import { SidebarRail } from './SidebarRail';
import { TopBar } from './TopBar';

function ShellFrame({ viewer, copilot, children }: { viewer: Viewer; copilot: boolean; children: ReactNode }) {
  const t = useTranslations('shell');
  const { roles } = usePermissions();
  useCommandPaletteShortcut();
  return (
    <div className="flex min-h-screen flex-col bg-bg-page text-text">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-400 focus:top-400 focus:z-90 focus:rounded-200 focus:bg-bg-surface focus:px-300 focus:py-200">
        {t('skipToContent')}
      </a>
      <TopBar />
      <CustomerSessionBanner />
      <div className="flex flex-1 items-start">
        <SidebarRail roles={roles} viewer={viewer} />
        <main id="main" tabIndex={-1} className="flex min-w-0 flex-1 flex-col gap-400 pb-1500 pr-1000 pt-600 max-lg:pr-600 narrow:px-400">
          {children}
        </main>
      </div>
      <MobileDrawer roles={roles} viewer={viewer} />
      <CommandPalette />
      {copilot ? <CopilotPanel /> : null}
    </div>
  );
}

/** The portal shell: providers, dark top bar, floating sidebar rail (drawer on narrow screens), overlays and the page body. */
export function Shell({ viewer, copilot = false, children }: { viewer: Viewer; copilot?: boolean; children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <OverlayProvider>
          <PaletteProvider>
            <ViewerProvider viewer={viewer}>
              <ShellFrame viewer={viewer} copilot={copilot}>{children}</ShellFrame>
            </ViewerProvider>
          </PaletteProvider>
        </OverlayProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
