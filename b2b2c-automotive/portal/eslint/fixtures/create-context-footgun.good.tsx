'use client';

import type { Data } from '@commercetools-demo/puck-types';
import { PageManager } from '@commercetools-demo/puck-page-manager';

export default function Page({ data }: { data?: Data }) {
  return <PageManager data={data} />;
}
