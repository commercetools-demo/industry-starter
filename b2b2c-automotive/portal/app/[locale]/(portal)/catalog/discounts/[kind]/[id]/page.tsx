import { notFound } from 'next/navigation';
import { DiscountEditor } from '@/components/discounts/DiscountEditor';

// Editor of one discount (workstream T): /catalog/discounts/product/<id> or /catalog/discounts/cart/<id>.
export default async function DiscountEditorPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (kind !== 'product' && kind !== 'cart') notFound();
  return <DiscountEditor kind={kind} id={id} />;
}
