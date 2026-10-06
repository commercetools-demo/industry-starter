import { useTranslations } from 'next-intl';
import { Table } from '@/components/ui/Table';
import type { Product } from '@/lib/types';

/** Brand, Origin, Storage, Dietary, Allergens; rows without data are omitted, and so is the table when none remain. */
export function SpecsTable({ product }: { product: Pick<Product, 'brand' | 'origin' | 'storage' | 'dietary' | 'allergens'> }) {
  const t = useTranslations('pdp.specs');
  const label = (group: 'dietary' | 'storage', key: string) => (t.has(`${group}Values.${key}`) ? t(`${group}Values.${key}`) : key);
  const rows: { name: string; value: string }[] = [
    { name: t('brand'), value: product.brand ?? '' },
    { name: t('origin'), value: product.origin ?? '' },
    { name: t('storage'), value: product.storage ? label('storage', product.storage) : '' },
    { name: t('dietary'), value: product.dietary.map((d) => label('dietary', d)).join(', ') },
    { name: t('allergens'), value: product.allergens.join(', ') },
  ].filter((row) => row.value !== '');
  if (rows.length === 0) return null;
  return (
    <Table caption={t('caption')} columns={[t('property'), t('value')]}>
      {rows.map((row) => (
        <tr key={row.name}>
          <th scope="row" className="font-medium">
            {row.name}
          </th>
          <td>{row.value}</td>
        </tr>
      ))}
    </Table>
  );
}
