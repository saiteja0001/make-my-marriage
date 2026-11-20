# Make My Marriage

Make My Marriage is a modular monolith in one TypeScript Next.js App Router
application running on Node.js. Explain any proposed architectural change
before making it.

## Project references

Use [PRD.md](docs/PRD.md) for product scope, [SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md)
for architecture, [DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md) for persistence,
and [API_DESIGN.md](docs/API_DESIGN.md) for HTTP contracts. Check the current
source before relying on historical implementation notes. Surface conflicting
requirements before choosing a resolution.

## Project status

Maintain [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md). Add or update an
entry in the same change whenever a major feature is built or its status
changes. Record what was delivered, the validation performed, and any mock
data or pending integrations.

## Code boundaries

- Keep `src/app/` focused on routing, layouts, and thin UI and HTTP entry
  points. Keep route-specific UI and fixtures near their routes. Put genuinely
  reusable UI in `src/components/ui/`.
- Keep business rules in `src/modules/`. When a feature needs Zod schemas,
  services, repositories, or Mongoose models, place them in the owning domain
  module. Introduce each layer only when it has work to do.
- Keep server infrastructure and provider adapters in `src/server/`.
  `src/modules/auth/` owns account and session rules and their persistence.
  `src/server/auth/` adapts Next.js requests and cookies to those rules by
  calling the auth module.
- Add API routes and domain folders as features arrive. Keep helpers with
  their owners and reserve `src/lib/` for pure utilities with multiple consumers.
- Derive private wedding access from the authenticated membership. Scope
  wedding-owned queries and resource references to that wedding. Guest access
  uses the appropriate share token and exposes only the fields the guest needs.

## Local development and validation

Use Node.js 24 and npm. Install from the existing lockfile with `npm ci` when
dependencies are needed. See [README.md](README.md) for local setup.

Run the checks relevant to your changes. The CI checks are:

```sh
npm run lint
npm run typecheck
npm run build
```
