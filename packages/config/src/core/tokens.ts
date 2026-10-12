import { Inject } from '@nestjs/common';

/** DI token for the validated, frozen configuration object. */
export const FLOWUP_CONFIG = Symbol('FLOWUP_CONFIG');

/** DI token for this process's role. */
export const FLOWUP_PROCESS_ROLE = Symbol('FLOWUP_PROCESS_ROLE');

/**
 * Injects the validated configuration. No application code reads
 * `process.env` directly (AGENTS.md §6.2); this is the only way in.
 */
export const InjectConfig = (): ParameterDecorator => Inject(FLOWUP_CONFIG);
