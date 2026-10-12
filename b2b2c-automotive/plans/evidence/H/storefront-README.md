<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream H storefront evidence (against fakes, no live calls)

Setup: `tools/fake-contentools` on 4010 (fixtures), a throw-away local stand-in for commercetools auth and `stores/key=` on 4020 (kept outside the repo, only so G's proxy can resolve the stores), `next dev -p 3011` with env pointing at both. Everything stopped afterwards.

| File | Proves |
| --- | --- |
| `storefront-north-1440.png` | `/en-US/mau-reseller-north`: navy theme at first paint (`--color-brand-700` `#1d3b78`, heading `rgb(29, 59, 120)`, `--radius-md` 10px) |
| `storefront-south-1440.png` | `/en-US/mau-reseller-south`: green theme (`#1f6f43`, `rgb(31, 111, 67)`, radius 3px) |
| `storefront-default-fallback-1440.png` | `/en-US/qa-unthemed` (no theme in Contentools, service falls back to `default`): maroon `#821810`, `<style id="store-theme">` empty |
| `storefront-theme-down-1440.png` | `FAIL_MODE theme-down` and no cached theme: built-in default maroon, no console errors or warnings |
| `storefront-theme-preview-south-1440.png` | `/dev/theme/mau-reseller-south`: primary `rgb(31, 111, 67)`, outline secondary button, fit-ok tint unchanged `rgb(234, 247, 233)` |
| `proxy-status.txt` | proxy allow-list answers in the browser |
| `spike-ssr.md` | SSR spike result |

Hostile theme: `curl /dev/theme/qa-hostile` (theme PUT into the fake) gave 0 matches for `__pwned` and an empty `<style id="store-theme-preview">`.
