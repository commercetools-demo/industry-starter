'use client';

import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import { useAssistant } from '@/context/assistant-context';

/**
 * The header's assistant button. It renders nothing when the assistant is off or no provider is mounted. It carries the scope class and a
 * text-colour utility on itself (the header's colour does not reach it), and a visible text label beside the icon.
 */
export default function AssistantLauncher() {
  const t = useTranslations('assistant');
  const { enabled, isOpen, toggle, launcherRef } = useAssistant();
  if (!enabled) return null;
  return (
    <button
      ref={(node) => {
        launcherRef.current = node;
      }}
      type="button"
      onClick={toggle}
      aria-expanded={isOpen}
      aria-controls="assistant-panel"
      className="assistant-scope transition-state inline-flex h-10 shrink-0 items-center gap-1.5 rounded-pill border border-line bg-surface px-3.5 text-sm font-semibold text-ink hover:border-accent max-mobile:px-2.5"
    >
      <Icon name="sparkle" size={18} className="text-accent" />
      <span className="max-mobile:sr-only">{t('launcher.label')}</span>
    </button>
  );
}
