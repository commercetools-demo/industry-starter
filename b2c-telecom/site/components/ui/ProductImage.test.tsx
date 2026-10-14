/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { render, screen } from '@testing-library/react';
import { ProductImage } from './ProductImage';

describe('ProductImage', () => {
  it('shows the picture, decorative (the name is written next to it)', () => {
    const { container } = render(<ProductImage src="https://your-loyalty-free-image-source.com/photos/1/a.jpeg" name="Spotify" sizes="10rem" />);
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
    expect(screen.queryByText('S')).not.toBeInTheDocument();
  });

  it('without a picture shows the initial of the name', () => {
    const { container } = render(<ProductImage src={undefined} name="spotify" sizes="10rem" />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('S')).toBeInTheDocument();
  });
});
