FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The operational fork uses SQLite for zero-admin local persistence.
# Prisma generate only validates the protocol here; it does not open the DB.
RUN DATABASE_URL="file:./build.db" npx prisma generate
RUN npm run build
# Stage the Prisma CLI with its FULL runtime dependency closure for the
# runner. Computed from the installed tree, not hand-listed: a partial copy
# shipped an image that crashed at start with MODULE_NOT_FOUND (issue #27).
RUN node scripts/stage-prisma-cli.mjs /app/prisma-cli

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN mkdir -p /data && chown nextjs:nodejs /data
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# Prisma CLI + full runtime dependency closure, staged by
# scripts/stage-prisma-cli.mjs in the builder (see issue #27: hand-copied
# subsets missed transitive deps and the container crash-looped at start).
# Still no npm invocation in this stage — a second npm install under QEMU
# arm64 emulation intermittently crashes with SIGILL (see PR #23).
COPY --from=builder /app/prisma-cli ./node_modules
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/data/crawlseo.db
# Invoke the CLI's real entry point, not node_modules/.bin/prisma: COPY
# flattens that symlink into a file, and the CLI then resolves its WASM
# relative to the wrong directory (fault 3 of issue #27).
CMD ["sh", "-c", "node node_modules/prisma/build/index.js db push --skip-generate && node server.js"]
