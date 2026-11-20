# Project status

Track major Make My Marriage milestones here. Update the relevant entry as a
feature progresses, and record what was delivered, how it was verified, and
any pending integration work.

## Project scaffold — complete

- Set up the Next.js App Router application with TypeScript, Tailwind,
  and npm. Added local development instructions, a placeholder environment
  file, and the `GET /api/health` endpoint.
- Added login and signup previews and a responsive demo workspace with a
  wedding overview, Events, and Tasks. The workspace uses sample wedding data.
- Added GitHub Actions checks for a clean install, lint, TypeScript, and the
  production build. All four commands passed locally, and the app routes and
  health response passed smoke checks.

## Public homepage — complete

- Built the public landing page using the Royal Heritage Stitch design. It
  shows a planning workspace preview, V1 feature highlights, and a sample
  wedding website. The previews share a fixture with the demo workspace.
- Kept the couples count, average rating, and uptime in a labelled
  **Sample metrics** section. Those values are placeholders for verified
  backend data.
- Passed lint, TypeScript, and the production build. Browser checks covered
  layouts at 320, 390, 768, and 1440 pixels, along with photos, section links,
  and demo navigation.

## Organiser accounts and sessions — complete

- Enabled organiser signup, login, logout, and the current account endpoint.
  Signup creates the account and its first session in one MongoDB transaction.
  Passwords use Argon2id and authenticated requests use an HTTP-only session
  cookie backed by a hashed token in MongoDB.
- Signup accepts passwords of six or more characters. Signup and login both
  have a Show/Hide password control.
- Moved the public sample workspace to `/demo`. The private `/app` entry
  requires a session and directs new accounts to `/onboarding`.
- Login applies hard quotas to trusted clients and client/email pairs. Repeated
  failed logins for an email receive a capped delay. Signup keeps a per-email
  quota, including in local development. Authentication retries collection and
  index setup after a transient failure.
- Passed lint, TypeScript, and the production build. API checks against an
  isolated MongoDB replica set covered concurrent duplicate signups, invalid
  credentials, cookie flags, session expiry and revocation, origin checks, and
  rate limits. Mobile Chrome verified signup, refresh, logout, and login.
- Desktop Chrome on `localhost:3001` verified six-character signup, field
  validation, duplicate email handling, password visibility on both forms,
  session persistence after refresh, logout, and signing back in. Signed-out
  visits to `/app` and `/onboarding` redirected to login. One logout click
  immediately after a refresh sent no request. The retest passed after the
  page finished loading.
- Regression checks with simulated storage covered login after repeated
  failures, requests without a trusted client address, and concurrent retry
  after an index setup failure.
- Wedding creation and password reset are planned as separate features.
