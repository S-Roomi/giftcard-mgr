# Gift Card Manager

A self-hosted app for organizing gift cards and planning how to spend them.
All signed-in users share the same categories and cards.

## Features

- **Categories and cards** — track code, PIN, balance, expiry, and notes.
- **Spending plans** — enter an amount to see which cards cover it, then record
  the spend. All cards are charged together or not at all.
- **History** — each category's **•••** menu → **View history** lists past
  spends. Card codes are masked.
- **Sorting** — each category remembers its own order (default: soonest expiry).
- **Themes** — Default, Rosé Pine, and Catppuccin.
- **Security** — password accounts, hashed sessions, origin checks, and login
  throttling. No public registration.

Built with Next.js 15, React 19, TypeScript, Tailwind CSS 4, tRPC, Prisma, and SQLite.

## Quick start

Requires Node.js 22.9+.

```sh
cp .env.example .env
npm install
npm run db:push                  # create the database schema
npm run auth:user -- <username>  # create an account or reset a password
npm run dev                      # http://localhost:3000
```

## Configuration

Set these in `.env` and restart the app after changes.

| Variable | Description | Example |
| --- | --- | --- |
| `DATABASE_URL` | SQLite database location | `file:./db.sqlite` |
| `APP_URL` | Exact browser origin (scheme, host, port) | `http://localhost:3000` |
| `APP_THEME` | Optional: `default`, `rosepine`, `catppuccin`, or `catppuccin-{mocha,frappe,macchiato,latte}` | `catppuccin-latte` |

## Deployment

### Docker

```sh
APP_URL="http://<host-ip>:6565" docker compose up -d --build
docker compose exec app npm run auth:user -- <username>
```

The app is served on port 6565 and the schema is applied on startup. Data lives
in the `giftcard-data` volume. `docker compose down -v` deletes it, so back up first:

```sh
docker compose cp app:/app/data/db.sqlite ./giftcard-backup.sqlite
```

### Local network

Set `APP_URL` to `http://<host-ip>:6565` and run `npm run dev:lan`. Use that
address on every device, including the host.

For access beyond your local network, put the app behind an HTTPS reverse proxy.

## Development

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server on port 3000 |
| `npm run dev:lan` | Dev server on all interfaces, port 6565 |
| `npm run typecheck` | Type-check |
| `npm run test:auth` | Integration tests (isolated server and database) |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run db:push` | Sync the schema to the database |
| `npm run db:studio` | Browse the database |

There are no Prisma migrations; use `npm run db:push` to create or update the
schema, and back up the database first.
