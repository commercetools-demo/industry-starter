// Where tailored images are stored (T-08, Q-T08): the Contentools object store through the server (`upload-file` under the store
// key), the clean URL saved in the tailoring. Production uses workstream U's `uploadStoreFile`; development fixtures use the fake
// store (live check M-T-4).
import 'server-only';
import { ApiError } from '@/lib/api';
import { CatalogError } from '@/lib/catalog/errors';
import { uploadStoreFile } from '@/lib/contentools/service';
import { devFixturesEnabled } from '@/lib/portal/seam';

export interface ImageStore {
  /** Uploads the file and returns its clean https URL (no query string, no fragment). */
  upload(storeKey: string, file: File): Promise<string>;
}

/** Tests and development fixtures: no network, a deterministic placeholder address. */
export class FakeImageStore implements ImageStore {
  readonly uploads: { storeKey: string; name: string; size: number }[] = [];
  async upload(storeKey: string, file: File): Promise<string> {
    this.uploads.push({ storeKey, name: file.name, size: file.size });
    const hash = [...`${storeKey}:${file.name}:${file.size}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    return `https://placehold.co/800x800/${hash.toString(16).padStart(8, '0').slice(0, 6)}/ffffff.png`;
  }
}

const UPLOAD_FAILED = 'The image could not be uploaded. Try again or paste an image address.';

/** Production: workstream U's server-side Contentools upload (JWT held on the server). Failures become a coded 400. */
export class ContentoolsImageStore implements ImageStore {
  async upload(storeKey: string, file: File): Promise<string> {
    try {
      return await uploadStoreFile(storeKey, { bytes: await file.arrayBuffer(), type: file.type, name: file.name });
    } catch (error) {
      if (error instanceof ApiError && error.status === 503) throw new CatalogError(400, 'UPLOAD_NOT_CONFIGURED', 'Image upload is not configured yet. Paste an image address instead.');
      throw new CatalogError(400, 'UPLOAD_FAILED', UPLOAD_FAILED);
    }
  }
}

let registered: ImageStore | undefined;

/** Tests may swap the store. */
export function registerImageStore(store: ImageStore | undefined): void {
  registered = store;
}

let fake: FakeImageStore | undefined;
const real = new ContentoolsImageStore();

export function getImageStore(): ImageStore {
  if (registered) return registered;
  return devFixturesEnabled() ? (fake ??= new FakeImageStore()) : real;
}
