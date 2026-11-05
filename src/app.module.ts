import { Module } from '@nestjs/common';
import { DatabaseModule } from './common/database/database.module.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { CompatibilityModule } from './modules/compatibility/compatibility.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MatchingModule } from './modules/matching/matching.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { PrivacyModule } from './modules/privacy/privacy.module.js';
import { ProfilesModule } from './modules/profiles/profiles.module.js';
import { PropertiesModule } from './modules/properties/properties.module.js';
import { SafetyModule } from './modules/safety/safety.module.js';

/**
 * Composition root. Only infrastructure and domain modules are registered
 * here; domain services belong to their own module.
 */
@Module({
  imports: [
    DatabaseModule,
    CatalogModule,
    AccountsModule,
    MediaModule,
    ProfilesModule,
    PrivacyModule,
    PropertiesModule,
    CompatibilityModule,
    MatchingModule,
    ChatModule,
    SafetyModule,
    NotificationsModule,
    HealthModule,
  ],
})
export class AppModule {}
