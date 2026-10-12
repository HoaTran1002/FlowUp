# `@flowup/config` — Redis / BullMQ

Phase 1 (`BE-01` §5) proves **connectivity only**. There is no queue name, no
processor, no retry configuration and no delivery queue here.

Two constraints are settled and must not be re-litigated by a later task:

1. **Redis is execution coordination only.** It is never the authoritative
   record of anything. PostgreSQL is the source of truth for events,
   deliveries, attempts, the retry schedule and audit history
   (`SYSTEM_ARCHITECTURE.md` §3, `INV-03`). A Redis outage must not lose work
   already accepted in PostgreSQL, and `maxmemory-policy noeviction` is
   non-negotiable because eviction would silently drop coordination state.
2. **v0.1 enqueues every job with `attempts: 1`.** The database owns the retry
   schedule; a second, queue-level retry loop must not exist
   (`TECHNICAL_DESIGN.md` §4, `apps/api/AGENTS.md` §5, `INV-04`).

`BE-08` adds the outbox dispatcher and the enqueue path. `BE-09` adds the
worker processor.
