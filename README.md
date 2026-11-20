# Make My Marriage

A wedding planning workspace for couples and their families. The public demo
uses sample wedding data, including a countdown based on a fixed planning date.
Organisers can create an account, set up a wedding, and open their private
wedding overview.

## Local development

Use Node.js 24 and npm. Install dependencies and start the development server
from the repository root.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The homepage, demo, and health
route run without environment variables. For accounts, copy `.env.example`
to the Git-ignored `.env.local` and set `MONGODB_URI` to a development
database and `SESSION_SECRET` to a private, random value. Restart the
development server after changing these settings.

Use a MongoDB replica set or Atlas cluster for account signup and wedding
creation transactions. When setting `NEXT_PUBLIC_APP_URL`,
use the same origin that visitors use to open the app, including the port
when applicable.

| Path | Purpose |
| --- | --- |
| `/` | Public landing page and demo entry |
| `/login`, `/signup` | Organiser account forms |
| `/app`, `/onboarding` | Private wedding overview with a local-date countdown and three-step wedding setup |
| `POST /api/wedding` | Create a wedding and its first Admin membership |
| `/demo` | Public sample wedding overview and countdown |
| `/demo/events`, `/demo/tasks` | Read-only sample schedule and checklist |
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
- `src/modules/` holds business features. Keep feature validation,
  services, repositories, and Mongoose models with the domain that owns them.
  Add each layer when its feature needs it.
- `src/server/` holds server-only infrastructure. `modules/auth/` owns
  account and session rules and their data. `server/auth/` adapts Next.js
  requests and cookies to those rules by calling the auth module.
- Keep shared helpers with their owners until multiple features need a pure
  utility and it has a clear home.

The [architecture documents](docs/) cover the full product and its later
infrastructure.
