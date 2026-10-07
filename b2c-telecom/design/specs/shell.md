# Shell — header, nav, footer

Source: `source/Malva Telecom.dc.html` (`<header>`, `<footer>`). Tokens: see `../DESIGN.md`.

## Header
- Sticky (`top:0; z-index:10`), `--color-brand-500`, text `--color-text-on-brand`, `--shadow-sm`.
- Inner: max `--container-width`, padding 14px 40px, flex, gap 32px, wrap.
- Wordmark "malva" lowercase, Exo 700 30px, 2px tracking, `brand-950`, links home.
- Nav (flex:1, gap 6px): Phone plans · Wireless internet · Cable internet · Add-ons. Pill, Exo 600 15px, 1px tracking, padding 10×18. Active = `brand-950` bg, white text.
- Right cluster (Exo 600 14px, 1px tracking): account link (`Log in` anonymous, `Hi, {firstName}` signed in; routes to login when anonymous) and bundle pill `My bundle · {count}` (`brand-950` bg, white, padding 10×20). Count = selected plans + add-ons.

## Footer
- `brand-950` bg, text `brand-100`, padding 40px 0. Left wordmark (Exo 700 28px, 2px tracking, `brand-500`); centre links (Exo 500 14px): Phone plans, Wireless internet, Cable internet, Add-ons, Support; right "© 2026 Malva Telecom" (Roboto 13px, `brand-300`). Links are plain text in the prototype — must become real links when built.

## Body defaults
Roboto, `--color-text`, white surface, `box-sizing:border-box`. Links `pink-700`, hover `pink-800`. Page = flex column, `min-height:100vh`, `main` flex 1.
