import { NotFoundView } from '@/components/layout/NotFoundView';

// "Doctor not found. Back to search" inside the locale layout, with HTTP 404.
export default function DoctorNotFound() {
  return <NotFoundView kind="doctor" />;
}
