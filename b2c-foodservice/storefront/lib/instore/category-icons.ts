import type { IconName } from '@/components/ui/Icon';

/** Icon of a category tile by the key of its root category (workstream R). A key the table does not know shows the bean. */
const BY_ROOT: Record<string, IconName> = {
  'mcf-cat-pods': 'capsule',
  'mcf-cat-coffee': 'bean',
  'mcf-cat-machines': 'machine',
  'mcf-cat-accessories': 'cup',
  'mcf-cat-gifts': 'gift',
};

export function categoryIcon(rootKey: string | undefined): IconName {
  return (rootKey && BY_ROOT[rootKey]) || 'bean';
}
