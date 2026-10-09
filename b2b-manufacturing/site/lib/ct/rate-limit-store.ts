import 'server-only';
import { apiRoot } from './client';
import { VersionConflict, type RateLimitStore } from '../rate-limit';

export const RATE_LIMIT_CONTAINER = 'mpw-ratelimit';

/** Rate-limit state in a Custom Object per hashed key, written with optimistic concurrency so parallel serverless instances cannot overwrite each other. */
export const customObjectStore: RateLimitStore = {
  async read(key) {
    try {
      const { body } = await apiRoot.customObjects().withContainerAndKey({ container: RATE_LIMIT_CONTAINER, key }).get().execute();
      return { hits: ((body.value as { hits?: number[] }).hits) ?? [], version: body.version };
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) return null;
      throw error;
    }
  },
  async write(key, hits, version) {
    try {
      await apiRoot.customObjects().post({ body: { container: RATE_LIMIT_CONTAINER, key, value: { hits }, ...(version === undefined ? {} : { version }) } }).execute();
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 409) throw new VersionConflict();
      throw error;
    }
  },
};
