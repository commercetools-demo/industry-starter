import { notFound } from 'next/navigation';
import KitchenSink from './KitchenSink';

// Dev-only page for checking the design system by eye. 404 in production; the predeploy check
// fails while app/[locale]/dev exists, and workstream Q deletes it.
export default function DesignKitchenSinkPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <KitchenSink />;
}
