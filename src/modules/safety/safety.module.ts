import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report, UserBlock } from './domain/entities/index.js';

/**
 * Safety bounded context: blocks and moderation reports.
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserBlock, Report])],
})
export class SafetyModule {}
