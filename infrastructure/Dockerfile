# FlowUp — one image, three processes (SYSTEM_ARCHITECTURE.md §3:
# "one codebase, separated responsibilities").
#
# Compose selects the process with the container `command`; the image itself is
# role-agnostic. ADR-06 is resolved in favour of the Bun RUNTIME, so the
# processes execute TypeScript directly and there is no compile step.

FROM oven/bun:1.3.14-alpine

WORKDIR /app

# Dependencies first, so a source change does not re-resolve the lockfile.
COPY package.json bun.lock ./
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/dispatcher/package.json apps/dispatcher/
COPY apps/worker/package.json apps/worker/
# The lockfile covers every workspace member, including apps/web (FE-01).
# Its manifest must be present for --frozen-lockfile to resolve; its source is
# not needed, because this image runs only the three backend processes.
COPY apps/web/package.json apps/web/

# Frozen: the image must never silently resolve a different dependency tree
# than CI did.
RUN bun install --frozen-lockfile

COPY tsconfig.base.json tsconfig.json prisma.config.ts ./
COPY prisma/ prisma/
COPY packages/ packages/
COPY apps/ apps/

# `prisma generate` does not connect to a database; it only needs the CLI
# config to resolve. The placeholder below is never used to open a connection
# and is overwritten by the real, injected DATABASE_URL at runtime.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" bun run db:generate

# `bun` is uid/gid 1000 in this image. Compose pins `user: "1000:1000"`.
USER bun

# Overridden per service by Compose. Defaults to the HTTP process.
CMD ["bun", "apps/api/src/main.ts"]
