# Make My Marriage

A wedding planning workspace for couples and their families. The initial
scaffold uses one sample wedding to demonstrate the public pages and responsive
workspace. The countdown uses a fixed planning date from the sample data.
The account screens are previews with disabled fields.

## Local development

Use Node.js 24 and npm. Install dependencies and start the development server
from the repository root.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The scaffold runs with no
environment variables. `.env.example` contains commented placeholders for
later development. Keep real local settings in the Git-ignored `.env.local`.

| Path | Purpose |
| --- | --- |
| `/` | Public landing page and demo entry |
| `/login`, `/signup` | Account UI previews |
| `/app` | Mock wedding overview and countdown |
| `/app/events`, `/app/tasks` | Read-only sample schedule and checklist |
| `/api/health` | Application liveness. Returns HTTP 200 with `{"data":{"status":"ok"}}`. |

## Checks

```sh
npm run lint
npm run typecheck
npm run build
```

## Code structure

- `src/app/` contains routes, layouts, Route Handlers, and UI or fixtures local
  to a route. Parenthesised folders group routes without changing their URLs.
- `src/components/ui/` holds UI elements reused across route groups.
- `public/` holds the landing-page photo.
- Add `src/modules/` as business features arrive. Keep feature validation,
  services, repositories, and Mongoose models with the domain that owns them.
  Add each layer when its feature needs it.
- Add `src/server/` for server-only infrastructure. `modules/auth/` will own
  account and session rules and their data. `server/auth/` will adapt Next.js
  requests and cookies to those rules by calling the auth module.
- Keep shared helpers with their owners until multiple features need a pure
  utility and it has a clear home.

The [architecture documents](docs/) cover the full product and its later
infrastructure.
