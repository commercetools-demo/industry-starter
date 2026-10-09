# Industry starters

Monorepo of commercetools industry starter storefronts. Each project is self-contained: its own dependencies, lockfile, plan/specs and Netlify site. There is no shared build and no npm workspace at the root.

## Projects

| Project | Description | App directory | Docs |
| --- | --- | --- | --- |
| [`b2c-grocery`](b2c-grocery/) | MALVA grocery storefront (Next.js 16 on commercetools) | `b2c-grocery/site` | [`site/README.md`](b2c-grocery/site/README.md), [`plan/`](b2c-grocery/plan/) |
| [`b2c-telecom`](b2c-telecom/) | MALVA Telecom (Next.js 16 on commercetools) | `b2c-telecom/site` | [`site/README.md`](b2c-telecom/site/README.md), [`plan/`](b2c-telecom/plan/) |
| [`b2c-healthcare`](b2c-healthcare/) | MALVA Healthcare (Next.js 16 on commercetools) | `b2c-healthcare/site` | [`site/README.md`](b2c-healthcare/site/README.md), [`plans/`](b2c-healthcare/plans/) |
| [`b2b-services`](b2b-manufacturing/) | MALVA Plumbing and Waste management (Next.js 16 on commercetools) | `b2b-manufacturing/site` | [`site/README.md`](b2b-manufacturing/site/README.md), [`plan/`](b2b-manufacturing/plans/) |

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
