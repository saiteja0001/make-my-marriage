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
database and `SESSION_SECRET` to a private, random value. `SESSION_TTL_DAYS`
sets the lifetime of new sessions in whole days from `1` to `400` and
defaults to `7`. Restart the development server after changing these
settings.

Use a MongoDB replica set or Atlas cluster for account signup and wedding
creation transactions. Set `NEXT_PUBLIC_APP_URL` to enable guest invitation
links. Use the origin that visitors use to open the app, including the port
when applicable.

For wedding member invitations, set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
(a verified Resend sender), and `NEXT_PUBLIC_APP_URL` (the invitation link
origin). Invitations expire after seven days. The member list is available
without the email configuration.

For the private photo gallery, set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME` in `.env.local`. Use credentials
scoped to the private development bucket. In the bucket's CORS settings, allow
the exact app origin, including the local port, and allow `PUT`, `GET`, and
`HEAD` with the `Content-Type` request header.

For guest gallery sharing, set `NEXT_PUBLIC_APP_URL` and a stable
`GALLERY_TOKEN_KEY` in `.env.local`. Generate the key once per environment:

```sh
node -p "require('node:crypto').randomBytes(32).toString('hex')"
```

Keep the key with the environment's secrets. The sharing panel uses it to
recover links that have already been issued.

| Path | Purpose |
| --- | --- |
| `/` | Public landing page and demo entry |
| `/login`, `/signup` | Organiser account forms |
| `/app`, `/onboarding` | Private wedding overview with a local-date countdown and three-step wedding setup |
| `/app/edit` | Edit the saved wedding details |
| `/gallery/[token]` | View wedding photos through an enabled guest gallery link |
| `/app/members` | View members. Admins can manage invitations, change roles, and remove members. |
| `/app/guests` | Manage guest groups and open or copy their invitations from group details |
| `/app/guests/rsvps` | View guest responses and attendance totals |
| `/app/photos` | Upload, view, download, and delete private wedding photos |
| `/invite/[token]` | Open a guest invitation and submit or edit an RSVP |
| `/member-invitations/[token]` | Sign in or create an account and accept a wedding invitation |
| `POST /api/wedding` | Create a wedding and its first Admin membership |
| `PATCH /api/wedding` | Update submitted wedding fields as an Admin or Manager |
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
