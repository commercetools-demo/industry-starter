import { Exo, Inter, Roboto } from 'next/font/google';

export const exo = Exo({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-exo', display: 'swap' });
export const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '700', '800', '900'], variable: '--font-inter', display: 'swap' });
export const roboto = Roboto({ subsets: ['latin'], weight: ['400', '500', '700', '900'], variable: '--font-roboto', display: 'swap' });
export const fontVariables = [exo.variable, inter.variable, roboto.variable].join(' ');
