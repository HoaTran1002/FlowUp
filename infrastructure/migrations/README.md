# `infrastructure/migrations`

Raw SQL that Prisma's schema language cannot express. **Empty in phase 1.**

Prisma migrations themselves live in `prisma/migrations` and are the only
migration mechanism (`TECHNICAL_DESIGN.md` §2 — centralized, not per
executable). This directory is for SQL that must be hand-written and then
pasted into a generated Prisma migration, or applied as its own migration step:

- **partial indexes** — for example the pending-delivery and due-outbox indexes
  in `DATABASE_DESIGN.md` §6, which Prisma cannot express with a `WHERE` clause.
- **locking and claim helpers** — the `FOR UPDATE SKIP LOCKED` claim statements
  and lease predicates in `DATABASE_DESIGN.md` §5–§6.
- **anything whose generated SQL must be reviewed by hand** before it ships
  (`INV-11`).

Rules:

- A schema change still ships as a Prisma migration (`INV-11`). Nothing here is
  applied outside the migration sequence.
- Reconcile every statement with `DATABASE_DESIGN.md` and flag any deviation
  explicitly before applying it (`apps/api/AGENTS.md` §7.4).
- Do not use this directory to work around a model Prisma *can* express.

First expected use: `BE-03`, step 5 of the migration sequence in
`DATABASE_DESIGN.md` §8.
