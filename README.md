# Industry starters

> **commercetools-labs** reference code. Freely available under the [MIT License](LICENSE), provided **AS IS and UNSUPPORTED**. See [SUPPORT.md](SUPPORT.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

Monorepo of commercetools industry starter storefronts. Each project is self-contained: its own dependencies, lockfile, plan/specs and Netlify site. There is no shared build and no npm workspace at the root.

## Projects

See [features.md](features.md) for what each project contains.

| Project | Description | App directory | Docs |
| --- | --- | --- | --- |
| [`b2c-grocery`](b2c-grocery/) | MALVA grocery storefront (Next.js 16 on commercetools) | `b2c-grocery/site` | [`site/README.md`](b2c-grocery/site/README.md), [`plan/`](b2c-grocery/plan/) |
| [`b2c-telecom`](b2c-telecom/) | MALVA Telecom (Next.js 16 on commercetools) | `b2c-telecom/site` | [`site/README.md`](b2c-telecom/site/README.md), [`plan/`](b2c-telecom/plan/) |
| [`b2c-healthcare`](b2c-healthcare/) | MALVA Healthcare (Next.js 16 on commercetools) | `b2c-healthcare/site` | [`site/README.md`](b2c-healthcare/site/README.md), [`plans/`](b2c-healthcare/plans/) |
| [`b2b-manufacturing`](b2b-manufacturing/) | MALVA Plumbing and Waste management (Next.js 16 on commercetools) | `b2b-manufacturing/site` | [`site/README.md`](b2b-manufacturing/site/README.md), [`plan/`](b2b-manufacturing/plans/) |
| [`b2b2c-automotive`](b2b2c-automotive/) | MALVA B2B2C automotive: reseller storefront and partner portal (Next.js 16 on commercetools) | `b2b2c-automotive/storefront`, `b2b2c-automotive/portal` | [`plans/`](b2b2c-automotive/plans/) |
| [`b2c-foodservice`](b2c-foodservice/) | MALVA Coffee: pods, beans and machines with store collection and subscriptions (Next.js 16 on commercetools) | `b2c-foodservice/storefront` | [`storefront/README.md`](b2c-foodservice/storefront/README.md), [`plans/`](b2c-foodservice/plans/) |

## Layout

```
.
├── README.md
└── <project>/
    ├── site/            # the app; Netlify base directory; has its own netlify.toml
    ├── plan/            # plan, decisions, guides
    ├── design/
    ├── openspec/        # specs
    └── .nvmrc
```

Work inside a project directory; run all commands from its `site/` folder (see the project's README for setup, environment variables and scripts).
