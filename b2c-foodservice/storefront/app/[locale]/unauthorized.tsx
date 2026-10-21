import ErrorPage from '@/components/error/ErrorPage';

/** 401 sign-in prompt. Never shown for an expired session: the account guard redirects to sign-in with the destination kept. */
export default function Unauthorized() {
  return <ErrorPage kind="unauthorized" />;
}
