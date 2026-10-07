# Industry starters

Monorepo of commercetools industry starter storefronts. Each project is self-contained: its own dependencies, lockfile, plan/specs and Netlify site. There is no shared build and no npm workspace at the root.

## Projects

| Project | Description | App directory | Docs |
| --- | --- | --- | --- |
| [`b2c-grocery`](b2c-grocery/) | MALVA grocery storefront (Next.js 16 on commercetools) | `b2c-grocery/site` | [`site/README.md`](b2c-grocery/site/README.md), [`plan/`](b2c-grocery/plan/) |

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
