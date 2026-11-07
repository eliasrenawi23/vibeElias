# syntax=docker/dockerfile:1.7
#
# Renawi Motors API image. Build from the REPO ROOT (npm workspaces need the root lockfile):
#
#   docker build -f apps/api/Dockerfile -t renawi-api .
#   docker run --rm -p 3000:3000 --env-file .env -e DATABASE_URL=... renawi-api
#
# Ignore rules: apps/api/Dockerfile.dockerignore (BuildKit picks it up for this Dockerfile).
# The container applies pending migrations (`prisma migrate deploy`) and then starts the API.

ARG NODE_IMAGE=node:22-bookworm-slim

# ---------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS base
ENV TZ=UTC \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false
# OpenSSL for the Prisma query engine; CA certificates for outgoing HTTPS.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------------------------------------------------------------------------------------------
# Manifests only, so the dependency layers are cached until a package.json / the lock changes.
# `npm ci` at the monorepo root needs the manifest of EVERY workspace listed in the lockfile.
FROM base AS manifests
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/brand/package.json packages/brand/

# ---------------------------------------------------------------------------------------------
# Full install (dev dependencies are needed to build shared with tsup and the API with nest).
FROM manifests AS deps
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace @renawi/api --workspace @renawi/shared

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w packages/shared \
 && npm exec -w apps/api -- prisma generate \
 && npm run build -w apps/api

# ---------------------------------------------------------------------------------------------
# Production dependencies only (prisma CLI is a runtime dependency for `migrate deploy`).
FROM manifests AS prod-deps
COPY apps/api/prisma apps/api/prisma
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --workspace @renawi/api --workspace @renawi/shared \
 && npm exec -w apps/api -- prisma generate \
 && mkdir -p apps/api/node_modules packages/shared/node_modules

# ---------------------------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000

# TODO(milestone 6 - PDFs): install Playwright Chromium and the self-hosted Rubik / Noto fonts
# for Hebrew/Arabic PDF rendering, e.g.
#   RUN npx playwright install --with-deps chromium
# (pin the playwright version from apps/api/package.json; run as root before `USER node`).

COPY --from=prod-deps --chown=node:node /app/package.json ./package.json
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps --chown=node:node /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build --chown=node:node /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=node:node /app/packages/shared/src/locales ./packages/shared/src/locales
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist

# Uploaded documents (milestone 2) live here; mount a volume in production.
RUN mkdir -p /data/uploads && chown node:node /data/uploads
ENV UPLOAD_DIR=/data/uploads

WORKDIR /app/apps/api
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>r.json()).then(j=>process.exit(j.db==='up'?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "node ../../node_modules/prisma/build/index.js migrate deploy && exec node dist/main.js"]
