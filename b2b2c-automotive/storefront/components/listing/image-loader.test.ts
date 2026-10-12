// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { productImageLoader } from './image-loader';

describe('Product card image: components/listing/image-loader', () => {
  it('sizes Pexels photos at render time', () => {
    expect(productImageLoader({ src: 'https://images.pexels.com/photos/1/p.jpeg', width: 440 })).toBe('https://images.pexels.com/photos/1/p.jpeg?auto=compress&cs=tinysrgb&w=440');
  });
  it('leaves every other URL as stored', () => {
    expect(productImageLoader({ src: 'https://cdn.example.test/a.jpg', width: 440 })).toBe('https://cdn.example.test/a.jpg');
    expect(productImageLoader({ src: '/local.svg', width: 440 })).toBe('/local.svg');
    expect(productImageLoader({ src: 'data:image/svg+xml;base64,AAA', width: 440 })).toBe('data:image/svg+xml;base64,AAA');
  });
});
