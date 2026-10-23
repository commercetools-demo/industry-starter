import { notFound } from 'next/navigation';
import Harness from './Harness';

// Dev-only harness for the store picker: opens it from the header context or with a SKU (before the product page
// exists). 404 in production; the predeploy check fails while app/[locale]/dev exists, and workstream Q deletes it.
export default function StorePickerHarnessPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Harness />;
}
