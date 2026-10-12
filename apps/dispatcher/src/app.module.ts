import { Module } from '@nestjs/common';
import { FlowUpCoreModule } from '@flowup/config';

/**
 * The `dispatcher` process root module.
 *
 * Phase 1 wires infrastructure only. There is NO outbox polling loop and no
 * BullMQ queue here: reading `OutboxMessage` rows, claiming due rows,
 * enqueueing minimal jobs and reconciling missed work are all BE-08.
 */
@Module({
  imports: [FlowUpCoreModule.forRole('dispatcher')],
})
export class AppModule {}
