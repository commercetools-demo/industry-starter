# Workstream H: gaps and things that may bite others

- The plan says "Header server shell reading session", but `components/**` may not import `lib/session`; solved with the layout-level fallback (H-questions 2, 3).
- G's `itemCount` is a quantity sum, contradicting Q-020; `lineCount` added (H-questions 1).
- The root layout and now the locale layout read the session per request, so every page is dynamic (G noted this). A fully static marketing page needs a split layout.
- The `lg:` footer grid and `sm:` hiding of the home "Sign in" button use Tailwind default breakpoints (640/1024 px) besides the design's 900 px; fine visually, but they are not design tokens.
- Tailwind `text-md`/`text-xs` etc. come from `--text-*` without line heights (B-missed); components rely on inherited line height.
- Avatar uses `next/image` with `unoptimized` (D-006) and is unverified with a real portrait URL (`images.remotePatterns` is not needed while unoptimized).
- jsdom prints "Not implemented: navigation to another Document" once when a test clicks a real link; harmless.
- Design lint is silent on Tailwind class strings except for `\d+px` and hex; arbitrary values such as `text-[length:clamp(...)]` pass. No raw hex, px or font strings were added (check: zero warnings from `design/adherence`).
- Logo "M" mark uses `--color-action-label` (navy) on azure instead of the prototype's white (same contrast reason as D-010).
