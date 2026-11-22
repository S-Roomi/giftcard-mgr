# Gift Card Manager — agent guidance

This file applies to the entire repository. Follow the user's current request;
the conventions below describe the existing app and should guide related changes.

## Project and structure

This is a self-hosted gift card organizer and spending planner. All authenticated
users share the same categories and cards; there is no per-user card ownership.

- Stack: Next.js 15 App Router, React 19, strict TypeScript, Tailwind CSS 4,
  tRPC 11, TanStack Query 5, Prisma 6, and SQLite.
- Use npm and the existing lockfile. Check `package.json` and `.tool-versions`
  for the project's tooling configuration.
- `src/app/page.tsx`: authenticated homepage and server-side data prefetch.
- `src/app/_components/use-page.tsx`: homepage shell, `?category=<id>`
  selection, and the selected category's header, actions menu, and spend submit.
- `src/app/_components/top-bar.tsx`: app name, New category, Add card, account
  menu with Sign out.
- `src/app/_components/category-sidebar.tsx`: totals, category list, mobile
  picker, and drag-and-drop reordering (`@dnd-kit`).
- `src/app/_components/card-table.tsx`: card table, sort control, row menus.
- `src/app/_components/planner-panel.tsx`: order total, allocation, note, and
  Record spend.
- `src/app/_components/category-history.tsx`: inline spend history.
- `src/app/_components/planner.ts`: card types, sorting, `planSpend`,
  `roundCents`, balance and expiring-soon helpers;
  `use-category-sort.ts`: the per-category sort hook.
- `src/app/_components/card-modal.tsx`: shared add/edit card dialog.
- `src/app/_components/category-form.tsx`: category creation and renaming.
- `src/server/api/routers/`: validated category and gift-card operations.
- `src/server/auth/`, `src/middleware.ts`, and `src/app/api/auth/`:
  authentication, sessions, origin checks, and login/logout.
- `src/trpc/`: query providers and client/server tRPC helpers.
- `prisma/schema.prisma`: data model; `src/server/db.ts`: shared Prisma client.
- `src/env.js`: environment validation; `src/styles/globals.css`: theme tokens.
- `tests/auth.integration.mjs`: integration tests using an isolated database,
  covering authentication, homepage rendering, category order, spending, and
  transaction history.

## Development and verification

- `npm install` installs dependencies and generates the Prisma client.
- `npm run dev` starts development on port 3000.
- `npm run dev:lan` listens on all interfaces on port 6565.
- `npm run typecheck` checks TypeScript.
- `npm run test:auth` starts a test server on port 3107 with a temporary SQLite
  database and a separate `.next-auth-test` build directory.
- `npm run build` builds production; `npm run start` serves that build.
- `npm run db:push` synchronizes the configured database schema.
- `npm run auth:user -- username` creates an account or resets its password.
  There is no default account or public registration.

Run checks appropriate to the change. Use typechecking for TypeScript changes and
integration tests for authentication, API, and protected-route changes. For UI
changes, check mobile and desktop behavior when a browser is available, and state
when visual or interaction testing was not performed. Documentation-only changes
do not require an application build.

Next.js generates route types. If typechecking reports a removed route under a
`.next*` directory, regenerate types for that directory, for example
`NEXT_DIST_DIR=.next-auth-test npx next typegen`. Do not weaken TypeScript checks
to hide stale generated files.

## UI and behavior conventions

- The homepage is a master–detail "Ledger" layout: a top bar, a category
  sidebar, and a main pane for the selected category. Management stays on the
  homepage: New category and Add card in the top bar (Add card defaults to the
  selected category), the category actions menu (Add card, Rename, Delete) in
  the category header, and card actions in each table row's menu.
- The selected category lives in the URL as `?category=<id>`, updated with
  `history.pushState` so reload and back/forward restore it. Unknown or deleted
  IDs fall back to the first category in sidebar order. Sidebar entries are real
  links with `aria-current="page"` on the selected one.
- Keep empty categories visible in the sidebar so users can add cards.
- Sidebar category order is shared by all users and stored in `Category.position`
  (ties sort by name; new categories go last). Change it only through
  `category.reorder`, which takes every category ID once and rejects stale lists.
  Mouse drag, touch press-and-hold, and keyboard (Space, arrows, Space) all
  reorder. Saves are queued in drop order and `category.getAll` is refetched
  after the last one. A mouse drop must never trigger link navigation.
- Layout is CSS-only on one component tree, so planner input and other state
  survive viewport changes:
  - Under 768px: a centered single column. The sidebar list becomes a category
    picker (with a **Reorder** button that reveals the list); then the category
    header, card table (rows restyle into stacked blocks), planner, and history.
  - 768–1279px: sidebar beside the main pane; the planner sits below the table.
  - 1280px and up: the planner sits beside the card table and history.
- The category header shows the available balance and card count only.
- Card rows highlight cards expiring within 30 days and dim empty or expired
  cards. Wide tables scroll in their own box. Row menus use the Popover API so
  the scroll box cannot clip them; they close on scroll and resize.
- Codes and PINs copy without opening the row menu: each has a labeled copy
  icon button, and clicking the value itself also copies it (skipped when the
  user has selected part of it). The PIN stays masked behind an eye toggle.
  The row menu holds Edit and Delete.
- Sorting is local to each category. Its sort control is always visible above
  the card table. The selected order drives both the table and spending-plan
  allocation.
- Persist sorting by stable category ID in browser localStorage
  (`giftcard-category-sort:<id>`). Default to soonest expiry and handle
  unavailable storage gracefully.
- The planner is not a form: pressing Enter in its fields must not record a
  spend before the allocation has been reviewed.
- History shows the five most recent spends inline; **View full history**
  reveals the rest of the loaded pages and **Load more** fetches older ones.
- Confirm card/category deletion; category deletion cascades to its cards.
- Reuse the existing dialog and forms. Preserve keyboard access, labels, focus
  handling, 44px touch targets, mobile scrolling, pending states, and visible
  mutation errors.
- Invalidate `category.getAll` after relevant mutations so balances and lists
  refresh. Preserve currency formatting and cent rounding in spending logic.

## Spending and transaction history

- Record planner spends only through `category.spend`. It runs in one database
  transaction: every selected card is charged and the history saved, or nothing
  changes. It rejects overspending, cards from other categories, and repeated
  cards, and refuses if a card's balance changed since it was read.
- History records planner spends only, not card creation, edits, or deletion.
  Each `Transaction` has an optional note and the recording user; each
  `TransactionEntry` holds one card's amount and balance afterwards.
- Never store or return full card codes or PINs in history; use the masked
  `cardLabel`. Deleting a card keeps its entries (`giftCardId` becomes null);
  deleting a category cascades to its history.
- Order history by transaction ID, not `createdAt`, so clock adjustments cannot
  reorder it. `category.history` paginates by ID cursor.
- Invalidate both `category.getAll` and `category.history` after spends and card
  deletions.
- Undo of a spend is planned. Keep per-card entries (`amount`, `balanceAfter`,
  `giftCardId`) intact so a spend can later be reversed.

## Themes and environment

- Use semantic Tailwind utilities such as `bg-canvas`, `bg-surface`,
  `text-foreground`, `text-accent`, and `text-on-primary`. Do not introduce
  hard-coded palette colors into components.
- `APP_THEME` supports `ledger` (black; the fallback when unset), `default`
  (slate), `rosepine`, `catppuccin` (Mocha), and
  `catppuccin-{mocha,frappe,macchiato,latte}`. Latte is a light theme; preserve
  readable foregrounds and light native controls. The server-rendered root
  `data-theme` selects CSS variables; preserve runtime selection for Docker.
- Add new themes to both the validation enum in `src/env.js` and the matching
  CSS variable block in `src/styles/globals.css`.
- `APP_URL` must match the browser's exact origin, including scheme and port.
  Redirects and mutation-origin checks depend on it. Restart after env changes.
- Update `.env.example` and documentation when adding configuration. Never print
  or commit private `.env` contents, credentials, card codes, PINs, or session tokens.

## Authentication and data safety

- Use `requirePageSession` for protected pages and `protectedProcedure` for
  business APIs. Keep server-side validation and mutation-origin checks intact.
- Preserve hashed session storage, password hashing, secure cookie behavior,
  session revocation, and persistent login throttling.
- Reuse the shared Prisma client and validate API inputs with Zod. Use
  `RouterOutputs` for client data types and the `~/` import alias.
- Do not hand-edit `generated/prisma`, `.next*`, or other generated outputs.
- Verify the target database before schema changes. Do not reset databases,
  remove Docker volumes, or use data-loss flags as routine troubleshooting.
  Back up existing data before a potentially destructive migration.
- The repository currently has no Prisma migration history; Docker startup uses
  `prisma db push --skip-generate`. Do not assume migration scripts alone
  initialize the schema.
- Compose stores SQLite at `/app/data/db.sqlite` in the persistent
  `giftcard-data` volume. Keep the database inside that volume; moving it
  requires locating, backing up, and migrating the existing file.

## Scope and handoff

Inspect the current files and git status before editing; preserve unrelated work.
Keep changes focused and follow nearby code style. Treat source code as the
authority when documentation or tests lag behind it.

Update relevant documentation for behavior changes. Report what changed, which
checks ran, and any unresolved failures without claiming unperformed verification.
