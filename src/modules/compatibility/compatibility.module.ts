import { Module } from '@nestjs/common';

/**
 * Compatibility has no tables of its own. It exposes pure calculation
 * services that `matching` and `properties` consume.
 */
@Module({})
export class CompatibilityModule {}
