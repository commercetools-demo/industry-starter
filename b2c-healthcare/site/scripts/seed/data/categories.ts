import { PREFIX } from '../lib';
import { L, SPECIALTIES } from './types';

export interface CategoryDef { key: string; name: string; slug: string; parent?: string }

export const DOCTORS_ROOT = `${PREFIX}doctors`;
export const MEDICINES_ROOT = `${PREFIX}medicines`;

export const specialtyCategoryKey = (specialty: string) => `${PREFIX}spec-${specialty}`;
export const classCategoryKey = (cls: string) => `${PREFIX}class-${cls}`;

export const MEDICINE_CLASSES = [
  { key: 'antibiotics', name: 'Antibiotics' },
  { key: 'pain-relief', name: 'Pain relief' },
  { key: 'allergy', name: 'Allergy' },
  { key: 'cardiovascular', name: 'Cardiovascular' },
  { key: 'diabetes', name: 'Diabetes' },
  { key: 'digestive', name: 'Digestive health' },
  { key: 'mental-health', name: 'Mental health' },
];

/** Parents first, so creating in array order never references a missing parent. */
export const CATEGORIES: CategoryDef[] = [
  { key: DOCTORS_ROOT, name: 'Doctors', slug: 'doctors' },
  ...SPECIALTIES.map((s) => ({ key: specialtyCategoryKey(s.key), name: s.label, slug: s.key, parent: DOCTORS_ROOT })),
  { key: MEDICINES_ROOT, name: 'Medicines', slug: 'medicines' },
  ...MEDICINE_CLASSES.map((c) => ({ key: classCategoryKey(c.key), name: c.name, slug: c.key, parent: MEDICINES_ROOT })),
];

/** An order hint is a string strictly between 0 and 1 that must not end in 0: 0.1 is rejected, 0.11 is fine. */
export const orderHint = (index: number): string => {
  if (index < 0 || index > 8) throw new Error('orderHint: index 0..8');
  return `0.${index + 1}1`;
};

export function categoryDrafts() {
  const siblingIndex = new Map<string, number>();
  return CATEGORIES.map((c) => {
    const n = siblingIndex.get(c.parent ?? '') ?? 0;
    siblingIndex.set(c.parent ?? '', n + 1);
    return {
      key: c.key,
      name: L(c.name),
      slug: L(c.slug),
      orderHint: orderHint(n),
      ...(c.parent ? { parent: { typeId: 'category', key: c.parent } } : {}),
    };
  });
}
