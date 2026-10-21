import { describe, expect, it } from 'vitest';
import { baseConfig } from './next.config';

describe('Image handling', () => {
  it('Images are unoptimized and https remote patterns are allowed', () => {
    expect(baseConfig.images?.unoptimized).toBe(true);
    expect(baseConfig.images?.remotePatterns).toEqual([{ protocol: 'https', hostname: '**' }]);
  });
  // "Stored URL with a query" is tested where the URL is written: workstream C,
  // 'strips query and fragment from stored image URLs'.
});
