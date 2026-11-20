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
