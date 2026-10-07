'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { ChoiceGroup } from './ChoiceGroup';

type DevicePickerProps = {
  colors: string[];
  memories: number[];
  color: string;
  memoryGb: number;
  onColor: (color: string) => void;
  onMemory: (memoryGb: number) => void;
};

const KNOWN_COLORS = new Set(['black', 'silver', 'violet']);

/** Color and memory of a handset: the two attributes that make a variant (D-015). Two radio groups of pills. */
export function DevicePicker({ colors, memories, color, memoryGb, onColor, onMemory }: DevicePickerProps): ReactElement {
  const t = useTranslations('devices');
  const colorLabel = (key: string): string => (KNOWN_COLORS.has(key) ? t(`colorName.${key as 'black'}`) : key);
  return (
    <div className="flex flex-col gap-5">
      <ChoiceGroup label={t('color')} choices={colors.map((value) => ({ value, label: colorLabel(value) }))} value={color} onChange={onColor} />
      <ChoiceGroup label={t('memory')} choices={memories.map((value) => ({ value: String(value), label: t('memoryValue', { gb: value }) }))} value={String(memoryGb)} onChange={(value) => onMemory(Number(value))} />
    </div>
  );
}
