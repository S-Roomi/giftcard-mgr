# Gift Card Manager

A self-hosted web app for organizing gift cards and planning how to spend them.
All signed-in users share the same categories and cards.

## Features

- **Categories** — group cards by store or purpose; rename or delete categories
  (deletion removes their cards after confirmation). Empty categories stay visible.
- **Cards** — track code, optional PIN, balance, expiry date, and notes. Add, edit,
  move between categories, or delete from a single shared dialog.
- **Spending plans** — enter an amount to see which cards cover it (in the
  category's sort order) and any shortfall, then deduct it from those balances.
- **Per-category sorting** — each category remembers its own order in the browser
  (default: soonest expiry).
- **Themes** — Default, Rosé Pine, and Catppuccin (Mocha, Frappé, Macchiato, Latte).
- **Security** — password accounts, hashed persistent sessions, origin-checked
  mutations, and login throttling. No public registration.

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · tRPC 11 ·
TanStack Query 5 · Prisma 6 · SQLite

## Quick start

**Requirements:** Node.js 22.9+ and npm.

```sh
cp .env.example .env        # then edit values as needed
npm install
npm run db:push             # create or sync the SQLite schema
npm run auth:user -- alice  # create an account (prompts for a password)
npm run dev
```

Open <http://localhost:3000> and sign in.

## Configuration

Set these in `.env`. Restart the app after any change.

| Variable | Description | Example |
| --- | --- | --- |
| `DATABASE_URL` | SQLite database location. | `file:./db.sqlite` |
| `APP_URL` | The exact origin used in the browser (scheme, host, and port). Login redirects and mutation origin checks depend on it. | `http://localhost:3000` |
| `APP_THEME` | Color theme (optional, defaults to `default`). | `catppuccin-latte` |

### Themes

| `APP_THEME` | Palette |
| --- | --- |
| `default` | Slate/emerald (dark) |
| `rosepine` | Rosé Pine (dark) |
| `catppuccin`, `catppuccin-mocha` | Catppuccin Mocha (dark) |
| `catppuccin-frappe` | Catppuccin Frappé (dark) |
| `catppuccin-macchiato` | Catppuccin Macchiato (dark) |
| `catppuccin-latte` | Catppuccin Latte (light) |

Unsupported values fail environment validation. To add a theme, extend the
`APP_THEME` enum in `src/env.js` and add a matching `:root[data-theme="<name>"]`
block in `src/styles/globals.css`.

## Usage

- **New category** (next to the page heading) creates a category.
- **Add card** (in the header or a category's ⋯ menu) opens the card dialog.
- The category ⋯ menu also provides **Rename** and **Delete**.
- **Show all cards** expands a category to reveal per-card edit/delete controls
  and the **Sort by** selector.

The layout is a single column on mobile, two columns at 768px, and three at 1280px.

## Account management

```sh
npm run auth:user -- <username>            # create a user or reset a password
npm run auth:user -- --delete <username>   # remove a user
```

- Passwords must be at least 12 characters and are hashed with salted scrypt.
- Sessions last seven days, persist across restarts, and are stored only as token
  hashes. Resetting a password revokes that user's sessions.
- Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` over HTTPS.
- Login attempts are limited to 10 per 15 minutes globally. This avoids trusting
  proxy IP headers, but repeated failures can briefly block all sign-ins.

## Deployment

### Docker

```sh
APP_URL="http://192.168.1.103:6565" docker compose up -d --build
docker compose exec app npm run auth:user -- <username>
```

Compose publishes host port **6565** to the container's port 3000. On startup the
container runs `prisma db push` to apply the schema, then starts the server.
Accounts must be created inside the deployed database.

> **Database location:** `compose.yaml` currently sets
> `DATABASE_URL=file:../app/db.sqlite`, which is **outside** the `/app/data`
> volume. Before recreating an existing deployment, back up the database, move it
> into the volume, and set `DATABASE_URL=file:/app/data/db.sqlite`.

### Local network (without Docker)

Set `APP_URL` to the host's LAN address (for example `http://192.168.1.103:6565`),
then run `npm run dev:lan`. Use that same address on every device, including the
host, so origin checks pass. Allow TCP port 6565 through the firewall if needed.

### Internet access

Plain HTTP does not encrypt passwords or session cookies. For access beyond your
local network, place the app behind an HTTPS reverse proxy and block direct access
to its port.

## Development

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server on port 3000 |
| `npm run dev:lan` | Start the dev server on all interfaces, port 6565 |
| `npm run typecheck` | Type-check the project |
| `npm run test:auth` | Run authentication integration tests |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run db:push` | Sync the Prisma schema to the database |
| `npm run db:studio` | Browse the database in Prisma Studio |

The project has no Prisma migration history; use `npm run db:push` to set up or
update the schema. Back up your database before schema changes.

Integration tests start an isolated server on port 3107 with a temporary SQLite
database. They cover route and API protection, origin checks, login and logout,
session expiry and rotation, account revocation, restart persistence, and throttling.

### Project structure

```
prisma/schema.prisma        Data model
scripts/manage-user.mjs     Account management CLI
src/app/                    Pages, layout, and auth API routes
src/app/_components/        Homepage UI, card dialog, category form
src/server/api/routers/     tRPC routers for categories and gift cards
src/server/auth/            Password hashing, sessions, origin checks
src/styles/globals.css      Theme tokens
tests/                      Integration tests
```
