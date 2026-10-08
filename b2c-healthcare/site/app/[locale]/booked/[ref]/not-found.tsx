import { NotFoundView } from '@/components/layout/NotFoundView';

// Unknown, expired and someone else's booking all end here: a plain "Not found." with HTTP 404.
export default function BookingNotFound() {
  return <NotFoundView kind="generic" />;
}
