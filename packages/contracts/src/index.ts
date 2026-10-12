/**
 * `@flowup/contracts` — the only place public contract types are shared
 * (docs/phase-1/README.md §6.2). The frontend never hand-copies a backend DTO.
 *
 * Phase 1 exports the error envelope, the cursor-pagination envelope and the
 * health/readiness responses. Business DTOs arrive with the tasks that define
 * their routes.
 */
export * from './correlation';
export * from './error';
export * from './health';
export * from './pagination';
