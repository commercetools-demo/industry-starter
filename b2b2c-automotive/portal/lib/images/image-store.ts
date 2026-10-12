// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Where uploaded images go (owner Q-U01, Q-T08): the Contentools object store under the store key, through the server. The
// interface lets routes and tests swap in a fake; workstream T may import it too. Server only.
import 'server-only';
import { uploadStoreFile, type UploadInput } from '@/lib/contentools/service';

export interface ImageStore {
  /** Stores one image for the store and returns its clean URL (no query string, no fragment). */
  upload(storeKey: string, file: UploadInput): Promise<string>;
}

export const ContentoolsImageStore: ImageStore = { upload: uploadStoreFile };

/** An in-memory store for tests: URLs on a fake host, nothing leaves the process. */
export function createFakeImageStore(host = 'https://files.example.test'): ImageStore & { uploads: { storeKey: string; name: string; type: string; size: number }[] } {
  const uploads: { storeKey: string; name: string; type: string; size: number }[] = [];
  return {
    uploads,
    async upload(storeKey, file) {
      uploads.push({ storeKey, name: file.name, type: file.type, size: file.bytes.byteLength });
      return `${host}/${storeKey}/${uploads.length}-${file.name}`;
    },
  };
}
