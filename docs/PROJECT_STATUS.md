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
- Password reset is planned as a separate feature.

## Wedding onboarding — complete

- Built the three-step Couple Details, Wedding Details, and Personalize flow
  using the Royal Heritage Stitch designs. Organisers review their details,
  keep their entries when going back, and can retry a failed save.
- An open draft stays tied to the account that started it. Organisers who
  switched accounts can return to their original account and retry the save.
- Wedding location uses manual entry. The wedding date is stored as a
  date-only value, and the editable timezone starts at `Asia/Kolkata`.
- `POST /api/wedding` reserves a stable slug and creates the wedding and its
  first Admin membership in one MongoDB transaction. A unique membership
  index enforces one wedding per account.
- `/app` shows the organiser’s own wedding after creation and on later sign-ins.
  Organisers without a membership are directed to setup, and the account API
  reports the saved membership and wedding summary.
- The setup form capitalizes the first letter entered for the couple’s names,
  location, title, and description. Organisers can edit the casing afterward.
  The dashboard header shows the signed-in organiser’s name and membership
  role next to Log out.
- The overview counts calendar days in the saved wedding timezone and updates
  while open. It shows a separate message on the wedding day and after it passes.
- Passed lint, TypeScript, and the production build. Chrome checks at 1440 and
  390 pixels covered field validation, retained values when going back, save
  failure and retry, and return to the private overview after logout and login.
  API checks on an isolated MongoDB replica set verified the one-wedding rule
  under concurrent submissions, slug collisions, and membership isolation.
- Countdown checks covered local midnight, different timezones at the same
  instant, daylight saving changes, leap day, and past wedding dates.
- API regression checks with simulated storage covered account changes during
  onboarding, unsupported location fields, and a membership lookup failure
  before login creates a session.
- The creation API and overview preserve the saved casing, including lowercase
  name particles and mixed-case descriptions.
- Component checks covered initial capitalization, manual casing edits,
  caret and selection placement, Unicode expansion at field limits, and
  input method editor composition.
- Location autocomplete, cover uploads, and gallery token creation are
  planned with their respective features.

## Edit wedding details — complete

- Added Edit wedding to the private overview and a prefilled, responsive form
  at `/app/edit` for Admins and Managers. Saving returns to the overview with
  updated details, a refreshed countdown, and confirmation.
- The form retains edits after failed saves and session expiry. It warns before
  leaving with unsaved edits and checks that a retried draft is still tied to
  the original account and wedding.
- `PATCH /api/wedding` updates submitted details and allows clearing the title
  and description. It scopes writes through the current membership and
  preserves the website slug and any existing gallery token.
- Passed lint, TypeScript, and the production build. Chrome checks at 1440 and
  390 pixels covered prefill, validation, cancel/discard, the browser leave
  warning, retry, reauthentication, and refreshed overview data. Isolated
  MongoDB checks covered Admin and Manager edits, concurrent partial updates,
  clearing optional fields, cross-wedding isolation, and link stability.
