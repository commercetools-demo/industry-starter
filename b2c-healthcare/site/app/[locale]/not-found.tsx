import { NotFoundView } from '@/components/layout/NotFoundView';

// Rendered inside the locale layout (header, footer, `#main`) with HTTP 404.
export default function LocaleNotFound() {
  return <NotFoundView />;
}
