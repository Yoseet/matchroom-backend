import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaAsset } from './domain/entities/index.js';

/**
 * Media bounded context: metadata for uploaded files. Binary content lives in
 * object storage; this context only tracks ownership and moderation state.
 */
@Module({
  imports: [TypeOrmModule.forFeature([MediaAsset])],
})
export class MediaModule {}
