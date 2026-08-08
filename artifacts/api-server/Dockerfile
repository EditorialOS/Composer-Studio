# Composer Studio API — production image.
# Multi-stage: build the esbuild bundle in a full workspace, then run it on a
# slim Node runtime. The bundle is self-contained (esbuild inlines pg, drizzle,
# @anthropic-ai/sdk, express, pino), so the runtime needs no node_modules.
#
# Build context is the REPO ROOT (pnpm monorepo). From /opt/composer:
#   docker build -f artifacts/api-server/Dockerfile -t composer .
# (docker-compose sets context: ../.. accordingly.)

FROM node:22-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@10.33.3 --activate
WORKDIR /app
COPY . .
# --no-frozen-lockfile: reconcile lockfile overrides across pnpm versions in CI/Docker
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @workspace/api-server run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app/artifacts/api-server/dist ./dist
EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
