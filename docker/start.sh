#!/bin/sh
set -eu

# This project currently has no Prisma migrations. `db push` initializes (and
# keeps in sync) the SQLite schema in the persistent volume before Next starts.
npx prisma db push --skip-generate
exec npm run start -- -H 0.0.0.0
