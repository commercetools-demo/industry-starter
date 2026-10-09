import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { SampleMarker } from '@/components/ui/content';

/**
 * Wraps a content item; when it is not yet confirmed (`sample: true`) shows the "Sample content" marker.
 * `corner` floats it top-right (for items with room, like stats); otherwise it sits above the item so it never covers text.
 */
export function Sampled({ sample, corner, children }: { sample: boolean; corner?: boolean; children: ReactNode }) {
  const t = useTranslations('content');
  const marker = sample ? <SampleMarker label={t('sampleMarker')} /> : null;
  if (corner) {
    return <div style={{ position: 'relative' }}>{children}{marker ? <span style={{ position: 'absolute', top: 12, right: 12 }}>{marker}</span> : null}</div>;
  }
  return <div>{marker ? <div style={{ marginBottom: 8 }}>{marker}</div> : null}{children}</div>;
}
