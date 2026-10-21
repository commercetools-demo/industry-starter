/**
 * Unknown `/api/*` paths answer JSON, never the HTML 404 page. Real routes are more specific, so Next matches them first.
 * Same body shape as the rest of the API: `{ error: { code, message } }`.
 */
function notFound(): Response {
  return Response.json({ error: { code: 'not_found', message: 'Not found' } }, { status: 404 });
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const OPTIONS = notFound;
export function HEAD(): Response {
  return new Response(null, { status: 404 });
}
