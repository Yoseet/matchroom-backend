import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Conversation,
  ConversationParticipant,
  Message,
} from './domain/entities/index.js';

/**
 * Chat bounded context: conversations, participants and messages.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Conversation,
      ConversationParticipant,
      Message,
    ]),
  ],
})
export class ChatModule {}
