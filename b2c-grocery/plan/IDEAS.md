# Ideas (out of scope, parked)

Juniors: add unrelated ideas here instead of changing code outside your task. Format: `- [WS-letter] idea`.
- [H] `hooks/useLocaleSwitch.ts` calls `fetch('/api/locale')` directly because `lib/fetcher.ts` (G-02) is not merged yet; switch it to `sendJson` once G is merged.
- [H] Footer shop links hold per-locale category slugs in `messages/*.json` (`footer.slugs.*`) to avoid a data call in the footer; when G-08/K expose the category tree, derive the links (and labels) from it.
- [H] Machine-translated German keys to review: `common.announcement`, `nav.searchPill/menu/closeMenu/primary/home`, `footer.*`, `a11y.language`.
- [H] Announcement bar text is generic ("Fresh groceries ... delivered to your door") because delivery thresholds must not be hard-coded (D-021, D-049); owner may want a different message.
- [H] Header on compact widths hides the search pill and saved icon below `tablet` (they are in the menu drawer); revisit when SO-01 is reviewed.
