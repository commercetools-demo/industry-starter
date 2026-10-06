# MALVA grocery storefront

Next.js 16 storefront on commercetools. The plan, decisions and specs live in `../plan/` and `../openspec/`.

## Setup
```bash
nvm use            # Node 22 (.nvmrc at the repo root)
npm ci
cp .env.example .env.local   # fill in the values you were given; never commit .env.local
npm run dev        # http://localhost:3000
npm run verify     # lockfile check, lint, typecheck, unit tests, build
```

Start with `../plan/README.md` and `../plan/JUNIOR-GUIDE.md`.
