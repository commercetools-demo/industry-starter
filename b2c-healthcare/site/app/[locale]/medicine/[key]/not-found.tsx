import { NotFoundView } from '@/components/layout/NotFoundView';

// "Medicine not found. Back to search" inside the locale layout, with HTTP 404.
export default function MedicineNotFound() {
  return <NotFoundView kind="medicine" />;
}
