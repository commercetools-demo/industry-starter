# Workstream C: todos

- G: scenario "Region not configured in commercetools" (filter `COUNTRY_CONFIG` by project settings, cached 300 s) and the atomic-session scenarios; `SUPPORTED_LOCALES`/`routing.locales` are currently the unfiltered table.
- H-10: replace the placeholder `app/[locale]/page.tsx`; add `error.tsx` and `not-found.tsx` under `[locale]` (`error-pages`). An unsupported locale already redirects in `proxy.ts`; `notFound()` in the layout is only a safety net.
- Typed messages (`AppConfig` augmentation for next-intl) not added; consider once more namespaces exist.
- Additional namespaces beyond `common` and `errors` are added by the workstream that needs them.
- No live/credential steps for C.
