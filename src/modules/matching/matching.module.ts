import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Match, UserInterest } from './domain/entities/index.js';

/**
 * Matching bounded context: one-way interest signals and the resulting
 * mutual match.
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserInterest, Match])],
})
export class MatchingModule {}
