# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM dependencies AS build
COPY . .
# DATABASE_URL is only required by the application's environment validation; no
# database connection is made while building the Next.js bundle.
RUN SKIP_ENV_VALIDATION=1 npm run build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/generated ./generated
COPY docker/start.sh /usr/local/bin/start-giftcard-mgr

RUN chmod +x /usr/local/bin/start-giftcard-mgr

EXPOSE 3000
CMD ["start-giftcard-mgr"]
