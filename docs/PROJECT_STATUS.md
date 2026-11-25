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
  completion totals and up to three upcoming tasks.
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
- After a draft's account or wedding settings change, the recovery link opens
  a fresh create or edit form in a new tab. Browser checks changed the wedding
  timezone and verified that both forms could save after reopening.

## Guest list — complete

- Added the private Guest List, with a desktop table, mobile cards and
  collapsible filters, a responsive drawer for creation and editing, and
  confirmed deletion from group details. Admins and Managers can search by
  name, email, or phone, and filter by event or read-only RSVP status.
  Pagination shows the number of groups that match those filters.
- Each group has a named guest, a party limit that includes that guest,
  optional contact details and organiser notes, and dated event selections.
  Previously selected archived events can be retained or removed.
- Guest writes are scoped to the signed-in wedding. New event links require
  active events. Organiser edits preserve existing attendance and stable
  invitation secrets, and cannot lower capacity below recorded attendance.
  Retrying an open draft reuses the original creation request and applies
  corrections to the saved group. The organiser's latest correction advances
  the revision even when its values match the saved group, if a previous
  correction could still be in flight. A deleted group's edit form keeps the
  draft visible and offers to open the Guest List in a new tab.
- The Guest List displays saved group, capacity, and RSVP summaries. The
  dashboard shows real guest and RSVP totals. Expense and vendor metrics still
  use labelled sample data.
- Passed lint, TypeScript, and the production build. Chrome checked the list
  from 320 to 1440 pixels and the drawer on desktop and mobile. Checks covered
  draft warnings and retention, validation, lost-response recovery, event
  filtering, and confirmed deletion.
- Isolated database checks covered wedding isolation, shared email addresses,
  literal search and pagination, archived links, capacity protection, and
  concurrent edits and retries. A regression check verified that Tasks still
  accepts active event links and rejects new links to archived events.
- Follow-up browser checks verified that correcting a draft after a lost create
  response updates one saved group, and that recovery after a concurrent
  deletion opens the Guest List.
- Browser and API checks verified that an earlier correction arriving late
  cannot undo a reverted draft, and both pages of a filtered list show
  the matching group total.
- Fixed a false event validation error when the running app reused a cached
  Mongoose event model. The event check uses the existing internal counter
  so it can reach MongoDB even with a cached schema. An isolated database
  check verified guest creation and editing with active events, and rejection
  of archived and cross-wedding events.

## Guest invitation links and RSVP — complete

- Added a sharing card to guest group details. Admins and Managers can copy
  the stable invitation link, select it manually if the clipboard is
  unavailable, or open it in a new tab. Links use the configured app origin.
- Built the standalone Stitch invitation with the couple's monogram, the
  group's active ceremonies, and an account-free RSVP form. Guests can
  accept, decline, or update their response using the same link. Failed saves
  retain choices, and a changed party limit is shown before the guest retries.
- RSVP drafts keep the revision they started from. When the invitation changes
  during editing, guests see the saved response and can keep their choices
  after reviewing it.
- Added the RSVP Summary with saved group totals, actual headcount, searchable
  response rows, and status filters. The dashboard shows the number of groups
  that responded and the number of people attending.
- Public responses expose only the invitation fields, use no-store,
  no-referrer, and noindex protections, and exclude token-bearing request
  paths from incoming request logs. RSVP updates enforce capacity and version
  checks and reuse the existing MongoDB counters for per-link and shared
  limits. Guest email delivery, WhatsApp shortcuts, and reminders are planned.
- Passed lint, TypeScript, and the production build. Chrome checked copy,
  clipboard fallback, opening a new tab, accepting and declining, editing a
  response, retrying after a failed submission, and a changed party limit.
  The public invitation fit widths from 320 to 1440 pixels.
- Isolated API checks covered wedding isolation, allowed event projections,
  invalid and deleted links, no-referrer and no-store responses, repeat
  submission, and both rate limits. Chrome verified that the dashboard and
  RSVP Summary show the current headcount.
- A two-session browser check verified that guests keep their choices while
  reviewing a newer RSVP. API checks confirmed that stale revisions cannot
  overwrite a different response, identical retries keep the saved timestamp,
  and simultaneous submissions respect guest capacity and revision checks.

## Private organiser photo gallery — complete

- Added the responsive Wedding Gallery for Admins and Managers at
  `/app/photos`. Photos can be filtered by wedding event or Wedding Memories,
  browsed by page, viewed full size, downloaded, and deleted individually.
- The upload drawer supports JPEG, PNG, and WebP up to 10 MiB per photo and 20
  files per batch. It shows progress, validation, partial success, and retry
  per file. In-progress drafts stay in the tab through session expiry.
- Browsers upload directly to the private R2 bucket with signed PUT URLs.
  The server checks stored length, MIME and the file signature, then publishes
  the verified object under a separate key. MongoDB stores gallery metadata
  and wedding ownership; ready photos use short-lived signed reading URLs.
- Guest upload links, QR sharing, and thumbnail derivatives are planned for
  later increments.
- Passed lint, TypeScript, and the production build. The development R2 bucket
  passed CORS, signed upload, verification, signed viewing and download, and
  cleanup checks.
- Chrome checked layouts from 320 to 1440 pixels, batch upload, partial
  success, retry after a lost confirmation, event filtering, full-size
  viewing, download, and confirmed deletion. An open upload draft survived
  sign-out and re-login, and was cleared when the account changed.
- API checks covered pagination, archived events, wedding isolation, image
  format validation, and replay of a staging upload after publication.
- Browser checks with mocked photo responses verified that expired previews
  request a fresh URL and that a failed refresh or replacement stops after
  one attempt. A route fixture verified the documented `data.success` response
  for deletion and the existing `404` behavior for missing photos.

## Guest gallery sharing — complete

- Added a desktop sharing drawer and mobile sheet for Admins and Managers.
  Guest viewing starts off. When enabled, organisers can copy the link or
  preview the guest gallery. Disabling and re-enabling preserves the link.
- Added the account-free guest gallery with event filters, pagination, and a
  full-size photo viewer. Event filters show categories with ready photos.
  Renewed previews load immediately so their short-lived URLs work even when
  a guest scrolls away while a refresh is in progress.
- Guest routes require the share token and enabled sharing. They return only
  the wedding names, date, event names, and guest photo fields. Photo URLs
  are signed for two minutes. MongoDB stores a token hash and an encrypted
  copy for authorised organisers to retrieve the link.
- Passed lint, TypeScript, and the production build. Chrome verified copying
  the link, account-free viewing of an actual R2 photo, layouts at 320, 390,
  and 1440 pixels, and restoring the same link after disabling sharing.
  API checks covered same-origin mutations, wedding isolation, guest response
  fields and privacy headers, and link stability after a wedding detail edit.
- Isolated API checks verified that guest filters include archived albums with
  ready photos and exclude empty, pending, deleted, and cross-wedding entries.
  A browser check with mocked storage verified that a renewed preview loads
  while the tile is off-screen.
- Guest uploads are tracked below. Printable QR codes remain planned.

## Guest photo uploads — complete

- Added a separate **Allow guest uploads** setting in the gallery sharing
  drawer. Organisers can pause contributions while keeping guest viewing
  on. Guest uploads start off and turn off when guest viewing is disabled.
- Built the mobile-first upload sheet with optional event tagging, file
  validation, progress, partial completion, and individual retries. Guests
  can upload JPEG, PNG, and WebP photos, up to 10 MiB each and 20 per batch.
- Reused the R2 staging and verification workflow. Guest reservations and
  confirmations are rate limited and scoped to the wedding. Publication
  checks that uploads are enabled in the same transaction that marks the
  photo ready. Guest photos appear immediately and are labelled for
  organisers, who can remove them.
- Passed lint, TypeScript, and the production build. Chrome verified uploads
  to the development R2 bucket, unsupported files, partial success, retry
  after a lost confirmation, event filtering, and returning to a view-only
  gallery after uploads were paused. API checks covered size limits, origin
  checks, wedding and event isolation, pause after storage transfer,
  confirmation idempotency, stable sharing links, and organiser deletion.
- Verified the rate limit and its `Retry-After` header, upload drawer widths
  of 320, 390, and 1440 pixels, and the existing organiser upload flow.
- Fixed the guest upload switch after a development reload. Cached Mongoose
  models now pick up the guest upload fields and photo ownership rules.
  An isolated MongoDB check reproduced the stale update and verified that
  both switch states persist with the refreshed models.
- While guest viewing is enabled, a confirmation retry returns the original
  photo ID after contributions are paused. Batch retries resolve earlier
  confirmations before creating reservations under a replacement event.
  An isolated MongoDB check verified the same photo ID after a pause and
  rejection of pending confirmations and new reservations. A browser check
  with mocked storage verified that one batch retry finished the remaining
  uploads without duplicating a previously published photo.
- Printable QR codes are tracked below.

## Printable wedding gallery QR — complete

- Added a QR preview and standalone PNG download to the gallery sharing
  panel. The QR encodes the existing gallery link, with guidance for
  viewing-only and upload-enabled galleries.
- Added a responsive A4 sign preview and a print layout that contains only
  the sign. The sign uses saved couple names and a scan instruction that
  remains accurate when guest uploads are paused.
- The browser generates the QR without a separate API or stored image.
  The panel highlights loopback addresses before organisers print a sign
  for guests.
- Passed lint, TypeScript, and the production build. Chrome verified the
  sharing states and preview widths at 320, 390, and 1440 pixels, including
  keyboard return to sharing. Decoded the downloaded PNG and rasterised A4
  PDF to the exact copied URL. The PDF contained only the sign on a single
  page, including with long couple names. The code stayed the same after
  changing a name, pausing viewing, and re-enabling sharing.

## Sign-in, sign-up, and app branding — complete

- Updated the organiser sign-in and sign-up pages with the Stitch sign-in
  layout, adapting it for account creation and smaller screens.
- Added a burgundy monogram to the account, homepage, demo, and workspace
  navigation, with a matching browser icon.
- Kept the existing email and password flows, including the six-character
  signup minimum and password visibility controls. The layout reuses the
  existing wedding photo.
- Passed lint, TypeScript, and the production build. Chrome verified signup,
  logout, sign-in, invalid email and credentials, password visibility, and
  layouts from 320 to 1440 pixels. The homepage and workspace monograms link
  to the homepage, and the browser icon loads.
- Anchored the photo gradient to the caption so it stays readable as the
  photo crops and the text wraps. Edge measured at least 5.29:1 contrast
  across the tested desktop viewports, including 1920 × 720, and 4.57:1
  against a white test background. Signup and sign-in checks also passed
  against an isolated MongoDB instance.

## Wedding Expense Tracker — complete

- Added the Expenses workspace with a wedding-wide INR total, category
  breakdown, and an expense ledger with category, event, and date filters.
  Filtered results show a separate subtotal. The dashboard uses the saved
  wedding total.
- Admins and Managers can add, edit, and delete expenses. The responsive form
  supports an optional event and notes, validation, retry, and discard
  confirmation. Expense amounts are stored as integer paise.
- Expense reads and writes are scoped to the current wedding. Create retries
  reuse the saved expense, including protection against recreating a deleted
  expense. Revisions protect edits and deletions from stale forms.
- Closing a form after an unconfirmed save refreshes the ledger and totals.
  List and summary requests use the same account and wedding context as the
  form. If it changes, the ledger prompts the organiser to reopen Expenses.
  Edge checks with isolated MongoDB verified that a committed expense
  appears once after its response is lost and that reopening after an
  account switch shows the newly signed-in wedding's rows and totals.
- Passed lint, TypeScript, and the production build. Chrome checked expense
  validation, draft discard, retry after a lost response, filtered results,
  editing and deletion, the dashboard total, and widths from 320 to 1440
  pixels. API checks covered exact paise totals, Admin and Manager access,
  wedding isolation, archived events, pagination, and stale or repeated
  requests.
- Expense changes refresh the workspace navigation cache. Chrome and Edge
  verified that browser Back shows the saved dashboard total after creating,
  editing, or deleting an expense, including after a lost create response
  was retried. Forward returns to the current ledger.
- Vendor linking follows the My Vendors increment.

## My Vendors directory — complete

- Added the private vendor directory with search by vendor or contact name,
  a category filter, pagination, and active and archived views.
- Admins and Managers can create, view, edit, and archive vendors. The
  responsive form handles contact details, an agreed cost in ₹, optional
  notes, and multiple wedding events. Archived vendor details remain
  available for reference.
- The directory totals are based on active vendors and their event links.
  The dashboard now shows the saved active-vendor count. Agreed costs are
  stored as integer paise on the vendor record.
- Passed lint, TypeScript, and the production build. Chrome checked
  validation, draft discard, retry after a lost response, contact links,
  search, category filtering, archived details, and the dashboard count.
  Layouts were checked at widths from 320 to 1440 pixels.
- Isolated API checks covered Admin and Manager access, wedding isolation,
  exact paise totals, expense totals, archived event links, pagination,
  literal search, and repeated or stale writes.
- Closing after an unconfirmed save or archive refreshes the directory
  and dashboard count. Directory reads use the page's membership and
  wedding context, and a mismatch prompts the organiser to reopen My
  Vendors. Edge checks with isolated MongoDB verified recovery after lost
  responses, account switching, and dashboard totals on browser Back.
- Chrome end-to-end QA verified that a mobile Manager can resume a vendor
  edit after session expiry and sign-in. It also confirmed that closing
  after a lost save or archive response refreshes the directory, and
  browser Back shows the saved dashboard count after creating or archiving.
- The dashboard and workspace menu use full navigation to My Vendors so
  browser Back warns about an unsaved draft. Edge verified that staying
  preserves the draft and that the dashboard count is current after Back
  following a create or archive. The dashboard also refreshes when the
  browser restores it from the Back/Forward cache. A simulated restoration
  event verified that path because Edge fetched a fresh dashboard on Back.
- Expense linking is tracked below. Vendor Discovery remains a separate increment.

## Vendor links in Expenses — complete

- Added the optional Related vendor field to expense creation and editing.
  The ledger displays the saved vendor name and supports filtering by vendor
  or by expenses with no vendor. The filtered subtotal covers all matching
  rows across pages.
- Existing links to archived vendors remain visible and editable. New links
  require an active vendor from the current wedding. Saving a new link and
  archiving that vendor are coordinated through a transaction.
- Older expenses and their creation request keys remain compatible. Vendor
  agreed costs stay on the vendor record, and expense totals use ledger
  entries.
- Passed lint, TypeScript, and the production build. Chrome checked vendor
  selection, filtering, and keeping or clearing an archived link at widths
  from 320 to 1440 pixels. API checks covered wedding isolation, archived
  links, legacy request keys, exact totals, and no-vendor filtering.
- Chrome QA also verified that a mobile Manager's vendor selection survives
  session expiry and sign-in. The dashboard total was current on browser
  Back after saving, and concurrent link and archive requests produced
  consistent saved records in an isolated database.
- Expenses uses the browser's discard confirmation when opened from the
  dashboard or workspace sidebar. Chrome verified that staying keeps the
  selected vendor and confirming navigation discards the draft.
- When a save rejects a vendor archived in another tab, Expenses disables
  that choice and refreshes the available vendors while keeping the draft.
  Chrome verified that choosing a replacement or No vendor allows saving.
  The expense vendor regression suite, lint, TypeScript, and the production
  build passed.
