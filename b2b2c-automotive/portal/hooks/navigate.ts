/** The one place that assigns `window.location` (tests replace this module). */
export function hardNavigate(url: string): void {
  window.location.assign(url);
}
