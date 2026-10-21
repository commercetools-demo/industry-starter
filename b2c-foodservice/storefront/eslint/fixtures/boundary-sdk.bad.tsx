'use client';
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';

export default function Widget() {
  return <span>{typeof createApiBuilderFromCtpClient}</span>;
}
