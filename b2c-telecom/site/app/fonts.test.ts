import { describe, expect, it, vi } from 'vitest';

describe('app/fonts.ts', () => {
  it('Fonts available without a flash of wrong type: Exo, Inter and Roboto load with the design weights', async () => {
    vi.resetModules();
    const { fontVariables } = await import('./fonts');
    const { Exo: exoLoader, Inter: interLoader, Roboto: robotoLoader } = await import('next/font/google');
    expect(exoLoader).toHaveBeenCalledWith({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-exo', display: 'swap' });
    expect(interLoader).toHaveBeenCalledWith({ subsets: ['latin'], weight: ['400', '500', '700', '800', '900'], variable: '--font-inter', display: 'swap' });
    expect(robotoLoader).toHaveBeenCalledWith({ subsets: ['latin'], weight: ['400', '500', '700', '900'], variable: '--font-roboto', display: 'swap' });
    expect(fontVariables).toBe('font-exo-var font-inter-var font-roboto-var');
  });
});
