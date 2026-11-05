import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuditLog,
  Notification,
  NotificationPreference,
  PushDevice,
} from './domain/entities/index.js';

/**
 * Notifications and audit bounded context: user notifications, channel
 * preferences, push registrations and the append-only audit trail.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationPreference,
      PushDevice,
      AuditLog,
    ]),
  ],
})
export class NotificationsModule {}
