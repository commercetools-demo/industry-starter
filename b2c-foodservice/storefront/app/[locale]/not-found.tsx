import ErrorPage from '@/components/error/ErrorPage';

/** 404 inside a valid locale: the shell is rendered by the locale layout. Static, no data. */
export default function NotFound() {
  return <ErrorPage kind="not-found" />;
}
