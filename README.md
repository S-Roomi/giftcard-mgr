# Gift Card Manager

A self-hosted gift card organizer and spending planner. All authorized users share the same categories and cards.

## Development

Use Node.js 22.9+ and npm. Copy `.env.example` to `.env`, then run:

```sh
npm install
npm run db:push
npm run auth:user -- your-username
npm run dev
```

The account command prompts for a password without displaying it. Open http://localhost:3000 and sign in. There is no default account or public registration.

`APP_URL` must match the browser's origin (scheme, hostname, and port), because forms and API mutations check the request origin. For development on another port, update it accordingly.

## Local network access on port 6565

Set `APP_URL` in `.env` to your hosting device's LAN address, for example:

```dotenv
APP_URL="http://192.168.1.103:6565"
```

Then run `npm run dev:lan`, or use Docker as described below. Open that same address on any device connected to your local network. The development server listens on all interfaces; Docker publishes host port 6565 to the application's internal port 3000. No hostname, Caddy, or router port forwarding is required. Allow TCP port 6565 through the host firewall if needed. Reserving the device's LAN IP in your router keeps the address stable.

Use the configured LAN address even when browsing on the hosting device, so login redirects and origin checks match. HTTP connections do not encrypt passwords or session cookies; use HTTPS for internet access.

## Accounts and sessions

Create another account or reset an existing account's password:

```sh
npm run auth:user -- another-username
```

Passwords must contain at least 12 characters and are stored using salted scrypt hashes. Resetting a password revokes that user's sessions. Remove access with:

```sh
npm run auth:user -- --delete another-username
```

Sessions last seven days, survive application restarts, and are invalidated on sign out. SQLite stores only session token hashes. Cookies are HttpOnly, SameSite=Lax, and Secure when using HTTPS. Every page except login requires a session; API calls require a session except the login endpoint. The data layer independently checks authentication, and mutations require a matching Origin header.

Login attempts are limited globally to ten per fifteen minutes, persisted in SQLite. This works behind proxies without trusting client-supplied IP headers; it also means repeated attempts can temporarily prevent everyone from signing in.

## Docker / production

Set `APP_URL` to the address used in your browser, such as `http://192.168.1.103:6565` for local network access. Compose exposes port 6565 directly; Caddy is not required. For internet access, use an HTTPS reverse proxy and restrict direct access to the app's port.

```sh
docker compose up -d --build
docker compose exec app npm run auth:user -- your-username
```

Startup applies the SQLite schema, including the authentication tables. Back up your existing database before deploying the schema update. Accounts must be provisioned in the deployed database; local accounts are not copied into the image.

The current Compose database URL is `file:../app/db.sqlite`, which resolves outside the volume mounted at `/app/data`. Before recreating an existing deployment, back up its database and migrate it to the volume, then set `DATABASE_URL` to `file:/app/data/db.sqlite`. The URL is deliberately not changed automatically, to avoid making existing cards appear missing.

Changing `APP_URL` requires restarting the application. API clients must send both their session cookie and the configured Origin header on mutations.

## Validation

```sh
npm run typecheck
npm run test:auth
```

Authentication tests start an isolated development server on port 3107 and use a temporary SQLite database. They check page/API protection, origin checks, login, logout, expiry, token rotation, account revocation, restart persistence, and throttling.
