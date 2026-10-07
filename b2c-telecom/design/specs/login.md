# Log in

Source: `isLogin`. `brand-100` band (padding 64×24) centring a card: max 440, radius 24, 1px border, `--shadow-sm`, padding 40, gap 20.

- H1 "Log in" (Exo 700 36) + "Access your plans, contract and bill." (muted 15).
- Fields: Email, Password — Exo 600 14 label (1px tracking); pill input (Roboto 16, padding 14×18, 1px `neutral-400` border, `outline:none` — **focus ring is missing; must add a visible focus style**).
- Error line (14px, `#a1262b`, reserved min-height 18): "Enter a valid email and password."
- Submit "Log in" (pink-700, Inter 800 16, padding 16, full width).
- Footnote: "Demo account is prefilled." (prototype only; remove for the real storefront).
- Return target: after login, go to the page that required it (`account` or `cart`).
- Not designed: registration, forgot password, federated sign-in, email verification.
