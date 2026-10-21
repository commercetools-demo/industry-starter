import ErrorPage from '@/components/error/ErrorPage';

/** 403. B2C code rarely calls forbidden() (D-015); an order that is not the shopper's is a not found, never a forbidden. */
export default function Forbidden() {
  return <ErrorPage kind="forbidden" />;
}
