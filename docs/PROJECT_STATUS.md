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
- The workspace wordmark links to the homepage. The homepage uses burgundy,
  ivory, and blush, and signed-in organisers see links to their workspace.
  The account links sit below the section links on narrow screens.
- Kept the couples count, average rating, and uptime in a labelled
  **Sample metrics** section. Those values are placeholders for verified
  backend data.
- Passed lint, TypeScript, and the production build. Browser checks covered
  layouts at 320, 390, 768, and 1440 pixels, along with photos, section links,
  and demo navigation.
- Chrome header checks covered both session states at 16 widths from 320 to
  1440 pixels. Focused checks covered the signed-out fallback when the session
  lookup fails and the unsaved-edit guard on the workspace wordmark.

## Organiser accounts and sessions — complete

- Enabled organiser signup, login, logout, and the current account endpoint.
  Signup creates the account and its first session in one MongoDB transaction.
  Passwords use Argon2id and authenticated requests use an HTTP-only session
  cookie backed by a hashed token in MongoDB.
- Signup accepts passwords of six or more characters. Signup and login both
  have a Show/Hide password control.
- New sessions use the configured `SESSION_TTL_DAYS` lifetime of 1 to 400
  whole days. The default is 7 days. Session checks with simulated storage
  covered the default, both limits, and rejection of invalid settings before
  a session is written.
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

## Wedding member invitations — complete

- Built the Wedding Members roster and invitation acceptance screens from the
  desktop and mobile Stitch designs. Admins can send and revoke invitations.
  Managers can view active members.
- Invitees can sign in or create an account from the invitation link, then
  join with the assigned role. Invitations expire after seven days, are
  stored as token hashes, and can be accepted once by the invited email.
  A transaction enforces the one-wedding rule during acceptance.
- Connected the Resend email adapter. Live delivery requires a verified
  sender, API key, and application URL. Tests used a local provider mock.
- Invitation creation, acceptance, and revocation share the per-wedding
  transaction guard with role changes and removals. Admin checks run inside
  the write transaction, and invitation emails are sent after commit.
- Passed lint, TypeScript, and the production build. Chrome covered the
  desktop and mobile roster, form validation, account switching, signup, and
  acceptance. Isolated MongoDB checks covered permissions, cross-wedding
  isolation, delivery retries, duplicate sends, revoke, expiry, and concurrent
  acceptance across weddings.
- Regression checks with simulated transactions covered Admin demotion during
  invitation writes, delivery after commit, and revocation after a failed
  send. Chrome verified that invitation POSTs keep their Origin header and
  omit the token URL from the referrer.

## Wedding member management — complete

- Added Admin-only role changes and confirmed removal to the active member
  roster. A removed member loses wedding access and returns to onboarding
  when they open the workspace.
- Role changes and removals check current membership and run in transactions
  serialized per wedding. The last Admin is protected from both actions.
- Chrome checked desktop and mobile layouts, promotion, and the choice to
  confirm or cancel removal.
  Isolated MongoDB checks covered Manager restrictions, cross-wedding access,
  invalid input, and concurrent demotion and removal of the final two Admins.
  Lint, TypeScript, and the production build passed.

## Wedding workspace layout — complete

- Added a shared workspace layout to the private dashboard, Wedding Details,
  and Wedding Members. Navigation uses a sidebar on desktop and a collapsible
  menu on smaller screens. The current destination is marked in the menu.
  Selecting it in the mobile menu closes the menu and returns focus to the
  menu button.
- The dashboard shows the saved wedding details, the timezone-aware countdown,
  and the existing edit and member actions. The header shows the signed-in
  organiser and their role.
- The countdown image uses responsive sizes that account for the two-column
  layout, desktop sidebar, and maximum dashboard width.
- The navigation includes the PRD's V1 areas. Future destinations are marked
  **Planned**, with expandable groups for guests, vendors, website themes,
  and photos. Events and tasks previews, guest and RSVP counts, expenses, and
  vendor counts are labelled **Sample data** while those features are pending.
  Upcoming features will add their routes and replace the relevant samples.
- Passed lint, TypeScript, and the production build.
- Chrome checked the dashboard at 320, 390, 768, 1024, and 1440 pixels. Checks
  covered mobile navigation and keyboard dismissal, membership redirects,
  Admin and Manager access, edit discard and save, and logout.
- Focused checks verified focus restoration and the unsaved-edit guard.
  Chrome selected the expected countdown image widths at eight viewport
  widths from 640 to 2560 pixels.

## Wedding events — complete

- Activated Events in the private workspace. Added a responsive schedule
  grouped by day, event details, create and edit forms with optional ceremony
  presets, and an archive confirmation with a read-only Archived view.
- Admins and Managers can manage events in their wedding. The Events API
  supports filtered lists and partial updates. It stores timestamps in UTC
  and renders them in the wedding timezone, including overnight events.
- The event form lets organisers choose an offset when a clock time repeats.
  The schedule shows both offsets when an event crosses a clock change.
- The Events sidebar link returns to the active schedule from Archived.
- Saves show inline errors and keep entries after a failed request. Creation
  retries reuse a request key, concurrent edits detect conflicts, and archives
  retain event records for later references.
- The dashboard shows a real count of active events and up to three
  upcoming events. Event cover uploads are planned for a later V1 increment.
- Passed lint, TypeScript, and the production build. Chrome checked desktop
  creation and mobile editing and archiving, including an overnight event,
  a lost create response, clearing an optional field, and dashboard updates.
- Isolated database checks covered Admin and Manager access, cross-wedding
  isolation, archived records, date filters, duplicate create retries, and
  edit conflicts.
- Focused checks covered saving across a repeated clock hour, skipped times,
  preserving a saved timestamp when editing other fields, and returning to
  the active schedule from Archived using the sidebar.
- Event creation and editing now warn before discarding a draft. In-app
  navigation uses a confirmation dialog, and document navigation uses the
  browser's leave warning. Chrome verified cancelling and confirming
  navigation from the event form and dismissing the reload warning.

## Wedding tasks — complete

- Added a private, responsive task list with All Tasks, My Tasks, and Completed
  views, literal title search, filters, and pagination. Organisers can create,
  assign, edit, complete, reopen, and delete tasks.
- Task APIs scope reads and writes to the signed-in wedding. New assignments
  require a current member, and new event links require an active event.
  Existing links to former members and archived events can be kept or
  cleared. Task saves coordinate with member removal and event archiving in
  MongoDB transactions. Conflicting edits return a conflict response.
- Creation keys remain reserved after hard deletion. A retry returns
  `410 Gone` for the deleted task, and the form keeps the draft so the
  organiser can choose to create a new task.
- Task due dates follow the wedding's calendar. The workspace shows which
  incomplete tasks are due today or overdue. The dashboard shows saved
  completion totals and up to three upcoming tasks. Guest, RSVP, expense,
  and vendor metrics still use labelled sample data.
- Task and event forms share confirmation before discarding unsaved changes.
  The leave warning resumes when browser Back restores a form from cache.
  Failed task saves retain entries and allow the organiser to retry.
- Passed lint, TypeScript, and the production build. Chrome checked creation,
  assignment, completion, reopening, editing, and confirmed deletion.
  Responsive checks covered widths from 320 to 1440 pixels. Chrome also
  verified mobile filters, browser Back with a draft, and a lost create
  response followed by retry.
- Isolated database checks covered wedding isolation, assignment validation,
  dated and undated tasks, pagination, literal search, stale edits, and
  retry deduplication. Date checks covered a skipped midnight and a skipped
  calendar day.
- Follow-up checks on a local MongoDB replica set covered concurrent creates
  with the same key, replay after hard deletion for new and older tasks,
  rollback after failed validation, and overlapping member removal and event
  archiving.
- A browser check covered a lost create response, deletion before retry, and
  explicit creation with a fresh key. A browser fixture for the shared draft
  component verified the reload warning after browser Back restored a form.
