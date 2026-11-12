# syntax=docker/dockerfile:1.7
#
# Renawi Motors web image: the Vite build of apps/web served by nginx, which also proxies /api/
# to the API container (deploy/nginx.conf). Build from the REPO ROOT (npm workspaces need the
# root lockfile):
#
#   docker build -f apps/web/Dockerfile -t renawi-web .
#
# Ignore rules: apps/web/Dockerfile.dockerignore (BuildKit picks it up for this Dockerfile).

ARG NODE_IMAGE=node:22-bookworm-slim
ARG NGINX_IMAGE=nginx:stable-alpine

# ---------------------------------------------------------------------------------------------
# Manifests only, so the dependency layer is cached until a package.json / the lock changes.
# `npm ci` at the monorepo root needs the manifest of EVERY workspace listed in the lockfile.
FROM ${NODE_IMAGE} AS deps
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/brand/package.json packages/brand/
# web + shared (incl. dev dependencies: vite, tsup). @renawi/brand is linked as a dependency of
# web; its own dev dependencies (logo build tooling) are not needed.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace @renawi/web --workspace @renawi/shared

# ---------------------------------------------------------------------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/brand packages/brand
COPY apps/web apps/web
RUN npm run build -w packages/shared \
 && npm run build -w apps/web \
 # Source maps stay out of the public site (they would publish the app's source code).
 && find apps/web/dist -name '*.map' -type f -delete

# ---------------------------------------------------------------------------------------------
FROM ${NGINX_IMAGE} AS runtime
# The stock default.conf is replaced; the security headers are shared by several locations.
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
# Fail the build early if the configuration is invalid (`api` is resolved at request time).
RUN nginx -t
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
