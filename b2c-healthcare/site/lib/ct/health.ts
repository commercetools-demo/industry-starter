import 'server-only';
import { getApiRoot } from '@/lib/ct/client';

/** Calls the project endpoint with the storefront client; returns the project key on success. */
export async function checkConnection(): Promise<{ projectKey: string }> {
  const { body } = await getApiRoot().get().execute();
  return { projectKey: body.key };
}
