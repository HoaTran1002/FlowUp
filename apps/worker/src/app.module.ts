import { Module } from '@nestjs/common';
import { FlowUpCoreModule } from '@flowup/config';

/**
 * The `worker` process root module.
 *
 * Phase 1 wires infrastructure only. There is NO BullMQ processor, NO HTTP
 * egress client, NO HMAC signing and NO SSRF validator here: lease, safe
 * egress, signing and attempt persistence are BE-09, and bounded retry and
 * lease recovery are BE-10.
 */
@Module({
  imports: [FlowUpCoreModule.forRole('worker')],
})
export class AppModule {}
