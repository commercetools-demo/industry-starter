import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
import { toHaveNoViolations } from 'jest-axe';
import { expect } from 'vitest';
expect.extend(toHaveNoViolations);
