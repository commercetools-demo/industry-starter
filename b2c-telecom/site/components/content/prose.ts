/** Typography of rendered markdown (no typography plugin): headings, paragraphs, lists and links inside a content column. */
export const PROSE =
  'font-body text-md leading-loose text-text ' +
  '[&_h2]:mt-9 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:leading-tight [&_h2]:text-brand-950 ' +
  '[&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-brand-950 ' +
  '[&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-7 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-7 [&_li]:my-2 ' +
  '[&_a]:text-text-link [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-pink-800';

export const KICKER = 'font-display text-sm font-semibold uppercase tracking-ui text-brand-800';
export const PAGE_TITLE = 'mt-3 font-display text-5xl font-bold leading-tight text-brand-950';
/** Outer padding of every content page: 80 px top, 40 px sides from 768 px up, 20 px below. */
export const PAGE_FRAME = 'px-5 pt-20 pb-20 md:px-10';
export const PAGE_COLUMN = 'mx-auto w-full max-w-(--content-width-prose)';
