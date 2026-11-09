import 'server-only';
import { contextFor, resolveSession } from '../host/sessions';
import { getSessionStore } from '../store';
import type { LoadedSession } from '../store/session-store';
import type { ShoppingSessionContext } from '../shopping/types';

/** The cookie-bound identity every assistant route reads. Never a body field. */
export interface AssistantCaller {
  agentSessionId?: string;
  customerId?: string;
  anonymousId?: string;
  country?: string;
  locale?: string;
}

/** The loaded agent session for the caller, or null when there is none for this user and market. */
export async function loadCallerSession(
  caller: AssistantCaller,
): Promise<{ loaded: LoadedSession; context: ShoppingSessionContext } | null> {
  const userId = caller.customerId ?? caller.anonymousId;
  if (!userId || !caller.agentSessionId) return null;
  const loaded = await resolveSession(getSessionStore(), caller.agentSessionId, {
    userId,
    ...(caller.country ? { country: caller.country } : {}),
    ...(caller.locale ? { locale: caller.locale } : {}),
  });
  return loaded ? { loaded, context: contextFor(loaded.session) } : null;
}
