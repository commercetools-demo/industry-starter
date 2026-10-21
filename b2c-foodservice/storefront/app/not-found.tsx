import ErrorPage from '@/components/error/ErrorPage';

/** 404 when no locale is known (for example an invalid locale segment): same page, default-locale messages, no shell. */
export default function RootNotFound() {
  return <ErrorPage kind="not-found" />;
}
