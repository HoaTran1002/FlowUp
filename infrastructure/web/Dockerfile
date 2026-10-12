# FlowUp web — static bundle served by an unprivileged nginx (FE-01 D10).
#
# SYSTEM_ARCHITECTURE.md §3: the SPA is a static artifact behind the HTTPS
# reverse proxy. TLS termination belongs to that proxy, not to this container.
#
# `VITE_API_BASE_URL` is the ONLY build-time input and it is not a secret
# (docs/phase-1/README.md §7). Nothing else from the environment can reach the
# bundle: Vite exposes only `VITE_`-prefixed variables, and `.env` is excluded
# by .dockerignore.

FROM oven/bun:1.3.14-alpine AS build

WORKDIR /app

# Every workspace manifest is needed for --frozen-lockfile to resolve, even
# though only apps/web and packages/contracts are built here.
COPY package.json bun.lock ./
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/dispatcher/package.json apps/dispatcher/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/

RUN bun install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/web apps/web

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Fail the image build, not the first page load, when the input is missing.
RUN test -n "$VITE_API_BASE_URL" || (echo "VITE_API_BASE_URL build arg is required" >&2 && exit 1)

RUN bun run --cwd apps/web build

FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime

COPY infrastructure/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --retries=6 --start-period=5s \
  CMD wget --quiet --spider http://127.0.0.1:8080/healthz || exit 1
