import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial MatchRoom MVP schema.
 *
 * The migration is intentionally explicit (instead of generated) because the
 * domain document defines many partial indexes, composite checks and
 * conditional uniqueness rules that must be reproduced exactly.
 *
 * Geospatial note: stock PostgreSQL does not ship PostGIS. The two location
 * columns use the native `point` type (longitude, latitude) so the MVP runs
 * everywhere. When PostGIS is enabled, change them to
 * `geography(Point,4326)`; the application transformer already handles the
 * `(lng,lat)` representation used by both types.
 */
export class InitSchema1762300800000 implements MigrationInterface {
  name = 'InitSchema1762300800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS citext;
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
    `);

    // -----------------------------------------------------------------------
    // 1. Catalogs
    // -----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE cities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        state_name text NOT NULL,
        country_code char(2) NOT NULL DEFAULT 'MX',
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE zones (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        city_id uuid NOT NULL REFERENCES cities(id),
        name text NOT NULL,
        slug text NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        CONSTRAINT uq_zones_city_slug UNIQUE (city_id, slug)
      );
      CREATE INDEX idx_zones_city_id ON zones(city_id);

      CREATE TABLE amenities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code text NOT NULL,
        name text NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        CONSTRAINT uq_amenities_code UNIQUE (code)
      );
    `);

    // -----------------------------------------------------------------------
    // 2. Accounts and access
    // -----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email citext NOT NULL,
        email_verified_at timestamptz,
        password_hash text,
        status text NOT NULL DEFAULT 'active',
        active_mode text NOT NULL DEFAULT 'seeker',
        landlord_enabled_at timestamptz,
        identity_status text NOT NULL DEFAULT 'not_started',
        identity_verified_at timestamptz,
        failed_login_count smallint NOT NULL DEFAULT 0,
        locked_until timestamptz,
        last_login_at timestamptz,
        deletion_requested_at timestamptz,
        deletion_scheduled_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_users_email UNIQUE (email),
        CONSTRAINT chk_users_status CHECK (status IN ('active','pending_deletion','suspended','deleted')),
        CONSTRAINT chk_users_active_mode CHECK (active_mode IN ('seeker','landlord')),
        CONSTRAINT chk_users_identity_status CHECK (identity_status IN ('not_started','in_progress','verified','rejected','manual_review')),
        CONSTRAINT chk_users_failed_login_count CHECK (failed_login_count >= 0)
      );

      CREATE TABLE auth_identities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider text NOT NULL,
        provider_user_id text NOT NULL,
        provider_email citext,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_auth_identities_provider_user UNIQUE (provider, provider_user_id),
        CONSTRAINT chk_auth_identities_provider CHECK (provider IN ('google'))
      );
      CREATE INDEX idx_auth_identities_user_id ON auth_identities(user_id);

      CREATE TABLE user_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        refresh_token_hash text NOT NULL,
        user_agent text,
        ip_address inet,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        last_used_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_user_sessions_refresh_token_hash UNIQUE (refresh_token_hash)
      );
      CREATE INDEX idx_user_sessions_active_user
        ON user_sessions(user_id)
        WHERE revoked_at IS NULL;

      CREATE TABLE one_time_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        purpose text NOT NULL,
        token_hash text NOT NULL,
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_one_time_tokens_token_hash UNIQUE (token_hash),
        CONSTRAINT chk_one_time_tokens_purpose CHECK (purpose IN ('email_verification','password_reset'))
      );
      CREATE INDEX idx_one_time_tokens_user_purpose ON one_time_tokens(user_id, purpose);

      CREATE TABLE legal_acceptances (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        document_type text NOT NULL,
        document_version text NOT NULL,
        adult_declared boolean NOT NULL,
        ip_address inet,
        accepted_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_legal_acceptances_user_document_version
          UNIQUE (user_id, document_type, document_version),
        CONSTRAINT chk_legal_acceptances_document_type
          CHECK (document_type IN ('terms','privacy'))
      );
    `);

    // -----------------------------------------------------------------------
    // 3. Files (metadata)
    // -----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE media_assets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id uuid NOT NULL REFERENCES users(id),
        kind text NOT NULL,
        storage_key text NOT NULL,
        mime_type text NOT NULL,
        size_bytes integer NOT NULL,
        width integer,
        height integer,
        moderation_status text NOT NULL DEFAULT 'pending',
        moderation_reason text,
        created_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        CONSTRAINT uq_media_assets_storage_key UNIQUE (storage_key),
        CONSTRAINT chk_media_assets_kind CHECK (kind IN ('profile_photo','property_photo','chat_image','report_evidence')),
        CONSTRAINT chk_media_assets_mime_type CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
        CONSTRAINT chk_media_assets_size CHECK (size_bytes BETWEEN 1 AND 5242880),
        CONSTRAINT chk_media_assets_moderation_status CHECK (moderation_status IN ('pending','approved','rejected'))
      );
      CREATE INDEX idx_media_assets_owner_user_id ON media_assets(owner_user_id);
    `);

    // -----------------------------------------------------------------------
    // 4. Profile and preferences
    // -----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE profiles (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        first_name text,
        last_name text,
        birth_date date,
        gender text,
        bio text,
        occupation text,
        contact_phone text,
        photo_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
        looking_for text NOT NULL DEFAULT 'both',
        city_id uuid REFERENCES cities(id),
        completeness_pct smallint NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_profiles_looking_for CHECK (looking_for IN ('roommate','housing','both')),
        CONSTRAINT chk_profiles_bio_length CHECK (bio IS NULL OR length(bio) <= 500),
        CONSTRAINT chk_profiles_completeness CHECK (completeness_pct BETWEEN 0 AND 100)
      );
      CREATE INDEX idx_profiles_city_completeness ON profiles(city_id, completeness_pct);

      CREATE TABLE lifestyle_profiles (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        cleanliness_level smallint,
        smokes boolean,
        has_pets boolean,
        noise_level smallint,
        visits_frequency text,
        sleep_schedule text,
        work_schedule text,
        cohabitation_type text,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_lifestyle_cleanliness CHECK (cleanliness_level BETWEEN 1 AND 5),
        CONSTRAINT chk_lifestyle_noise CHECK (noise_level BETWEEN 1 AND 5),
        CONSTRAINT chk_lifestyle_visits CHECK (visits_frequency IN ('never','rare','sometimes','often')),
        CONSTRAINT chk_lifestyle_sleep CHECK (sleep_schedule IN ('early','regular','late')),
        CONSTRAINT chk_lifestyle_work CHECK (work_schedule IN ('morning','afternoon','night','remote','flexible')),
        CONSTRAINT chk_lifestyle_cohabitation CHECK (cohabitation_type IN ('join_existing_home','find_place_together','any'))
      );

      CREATE TABLE roommate_preferences (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        smoking_policy text,
        pets_policy text,
        max_noise_level smallint,
        max_visits_frequency text,
        min_cleanliness_level smallint,
        min_age smallint,
        max_age smallint,
        exclusive_criteria text[] NOT NULL DEFAULT '{}',
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_roommate_smoking_policy CHECK (smoking_policy IN ('accept','reject','indifferent')),
        CONSTRAINT chk_roommate_pets_policy CHECK (pets_policy IN ('accept','reject','indifferent')),
        CONSTRAINT chk_roommate_max_noise CHECK (max_noise_level BETWEEN 1 AND 5),
        CONSTRAINT chk_roommate_max_visits CHECK (max_visits_frequency IN ('never','rare','sometimes','often')),
        CONSTRAINT chk_roommate_min_cleanliness CHECK (min_cleanliness_level BETWEEN 1 AND 5),
        CONSTRAINT chk_roommate_age_range CHECK (min_age IS NULL OR max_age IS NULL OR min_age <= max_age),
        CONSTRAINT chk_roommate_exclusive_criteria
          CHECK (exclusive_criteria <@ ARRAY['smoking','pets','noise','visits','cleanliness','age']::text[])
      );

      CREATE TABLE housing_preferences (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        property_type text,
        budget_min numeric(12,2),
        budget_max numeric(12,2),
        move_in_date date,
        requires_furnished boolean,
        requires_pets_allowed boolean,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_housing_property_type CHECK (property_type IN ('room','apartment','any')),
        CONSTRAINT chk_housing_budget_min CHECK (budget_min IS NULL OR budget_min >= 0),
        CONSTRAINT chk_housing_budget_max CHECK (budget_max IS NULL OR budget_max >= 0),
        CONSTRAINT chk_housing_budget_range CHECK (budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max)
      );

      CREATE TABLE user_preferred_zones (
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        zone_id uuid NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, zone_id)
      );
      CREATE INDEX idx_user_preferred_zones_zone_user ON user_preferred_zones(zone_id, user_id);

      CREATE TABLE housing_preference_amenities (
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amenity_id uuid NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, amenity_id)
      );
    `);

    // -----------------------------------------------------------------------
    // 5. Privacy and verification
    // -----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE privacy_settings (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        profile_visibility text NOT NULL DEFAULT 'everyone',
        show_exact_age boolean NOT NULL DEFAULT true,
        show_occupation boolean NOT NULL DEFAULT true,
        show_photo boolean NOT NULL DEFAULT true,
        appear_in_search boolean NOT NULL DEFAULT true,
        show_housing_preferences boolean NOT NULL DEFAULT true,
        show_property_interest boolean NOT NULL DEFAULT false,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_privacy_settings_visibility
          CHECK (profile_visibility IN ('everyone','verified_only','matches_only'))
      );

      CREATE TABLE privacy_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        request_type text NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        details text,
        created_at timestamptz NOT NULL DEFAULT now(),
        resolved_at timestamptz,
        CONSTRAINT chk_privacy_requests_type
          CHECK (request_type IN ('access','rectification','cancellation','opposition')),
        CONSTRAINT chk_privacy_requests_status
          CHECK (status IN ('pending','in_progress','completed','rejected'))
      );

      CREATE TABLE identity_verifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider text NOT NULL,
        provider_reference text,
        status text NOT NULL,
        attempt_number smallint NOT NULL,
        rejection_code text,
        started_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_identity_verifications_user_attempt UNIQUE (user_id, attempt_number),
        CONSTRAINT chk_identity_verifications_status
          CHECK (status IN ('in_progress','verified','rejected','manual_review'))
      );
      CREATE UNIQUE INDEX uq_identity_verifications_in_progress_user
        ON identity_verifications(user_id)
        WHERE status = 'in_progress';
    `);

    // -----------------------------------------------------------------------
    // 6. Properties
    // -----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE properties (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        landlord_id uuid NOT NULL REFERENCES users(id),
        title text,
        description text,
        property_type text,
        city_id uuid REFERENCES cities(id),
        zone_id uuid REFERENCES zones(id),
        address_exact text,
        location_exact point,
        location_public point,
        rent_amount numeric(12,2),
        deposit_amount numeric(12,2),
        additional_costs_estimate numeric(12,2),
        currency char(3) NOT NULL DEFAULT 'MXN',
        available_from date,
        bedrooms smallint,
        bathrooms smallint,
        furnished boolean NOT NULL DEFAULT false,
        pets_allowed boolean NOT NULL DEFAULT false,
        smokers_allowed boolean NOT NULL DEFAULT false,
        house_rules text,
        requires_guarantor boolean NOT NULL DEFAULT false,
        requires_income_proof boolean NOT NULL DEFAULT false,
        min_contract_months smallint,
        status text NOT NULL DEFAULT 'draft',
        rejection_reason text,
        reviewed_at timestamptz,
        published_at timestamptz,
        expires_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        CONSTRAINT chk_properties_type CHECK (property_type IN ('room','apartment')),
        CONSTRAINT chk_properties_status CHECK (status IN ('draft','in_review','active','reserved','rented','paused','rejected','deleted','expired')),
        CONSTRAINT chk_properties_rent CHECK (rent_amount IS NULL OR rent_amount > 0),
        CONSTRAINT chk_properties_deposit CHECK (deposit_amount IS NULL OR deposit_amount >= 0),
        CONSTRAINT chk_properties_additional_costs CHECK (additional_costs_estimate IS NULL OR additional_costs_estimate >= 0),
        CONSTRAINT chk_properties_bedrooms CHECK (bedrooms IS NULL OR bedrooms >= 0),
        CONSTRAINT chk_properties_bathrooms CHECK (bathrooms IS NULL OR bathrooms >= 0),
        CONSTRAINT chk_properties_min_contract CHECK (min_contract_months IS NULL OR min_contract_months >= 0),
        CONSTRAINT chk_properties_title_length CHECK (title IS NULL OR length(title) <= 120),
        CONSTRAINT chk_properties_publishable CHECK (
          status IN ('draft','deleted') OR (
            title IS NOT NULL
            AND property_type IS NOT NULL
            AND city_id IS NOT NULL
            AND zone_id IS NOT NULL
            AND rent_amount IS NOT NULL
            AND available_from IS NOT NULL
            AND location_public IS NOT NULL
          )
        )
      );
      CREATE INDEX idx_properties_search
        ON properties(city_id, zone_id, rent_amount)
        WHERE status = 'active' AND deleted_at IS NULL;
      CREATE INDEX idx_properties_location_public ON properties USING gist (location_public);
      CREATE INDEX idx_properties_landlord_status ON properties(landlord_id, status);

      CREATE TABLE property_photos (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        asset_id uuid NOT NULL REFERENCES media_assets(id),
        position smallint NOT NULL,
        is_cover boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_property_photos_asset_id UNIQUE (asset_id),
        CONSTRAINT uq_property_photos_property_position UNIQUE (property_id, position),
        CONSTRAINT chk_property_photos_position CHECK (position BETWEEN 1 AND 15)
      );
      CREATE UNIQUE INDEX uq_property_photos_cover
        ON property_photos(property_id)
        WHERE is_cover = true;

      CREATE TABLE property_amenities (
        property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        amenity_id uuid NOT NULL REFERENCES amenities(id),
        PRIMARY KEY (property_id, amenity_id)
      );

      CREATE TABLE property_status_history (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
        from_status text,
        to_status text NOT NULL,
        reason text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_property_status_history_property_created
        ON property_status_history(property_id, created_at);

      CREATE TABLE favorite_properties (
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, property_id)
      );
    `);

    // -----------------------------------------------------------------------
    // 7. Interest, match and compatibility
    // -----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE user_interests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_user_interests_pair UNIQUE (from_user_id, to_user_id),
        CONSTRAINT chk_user_interests_action CHECK (action IN ('interested','dismissed')),
        CONSTRAINT chk_user_interests_not_self CHECK (from_user_id <> to_user_id)
      );
      CREATE INDEX idx_user_interests_to_action ON user_interests(to_user_id, action);
      CREATE INDEX idx_user_interests_from_interested
        ON user_interests(from_user_id, created_at)
        WHERE action = 'interested';

      CREATE TABLE matches (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_a_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_b_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'active',
        unmatched_by uuid REFERENCES users(id) ON DELETE SET NULL,
        matched_at timestamptz NOT NULL DEFAULT now(),
        unmatched_at timestamptz,
        CONSTRAINT uq_matches_pair UNIQUE (user_a_id, user_b_id),
        CONSTRAINT chk_matches_order CHECK (user_a_id < user_b_id),
        CONSTRAINT chk_matches_status CHECK (status IN ('active','unmatched'))
      );
      CREATE INDEX idx_matches_user_a ON matches(user_a_id);
      CREATE INDEX idx_matches_user_b ON matches(user_b_id);
    `);

    // -----------------------------------------------------------------------
    // 8. Chat
    // -----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        kind text NOT NULL,
        match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
        property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
        initiator_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'active',
        closed_reason text,
        last_message_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_conversations_kind CHECK (kind IN ('roommate','rental')),
        CONSTRAINT chk_conversations_status CHECK (status IN ('active','closed')),
        CONSTRAINT chk_conversations_closed_reason
          CHECK (closed_reason IN ('unmatched','blocked','account_deleted')),
        CONSTRAINT chk_conversations_kind_shape CHECK (
          (kind = 'roommate' AND match_id IS NOT NULL AND property_id IS NULL AND initiator_user_id IS NULL)
          OR
          (kind = 'rental' AND property_id IS NOT NULL AND match_id IS NULL AND initiator_user_id IS NOT NULL)
        )
      );
      CREATE UNIQUE INDEX uq_conversations_match
        ON conversations(match_id)
        WHERE kind = 'roommate';
      CREATE UNIQUE INDEX uq_conversations_property_initiator
        ON conversations(property_id, initiator_user_id)
        WHERE kind = 'rental';
      CREATE INDEX idx_conversations_last_message_at
        ON conversations(last_message_at DESC);

      CREATE TABLE conversation_participants (
        conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_read_at timestamptz,
        joined_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (conversation_id, user_id)
      );
      CREATE INDEX idx_conversation_participants_user_conversation
        ON conversation_participants(user_id, conversation_id);

      CREATE TABLE messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id uuid NOT NULL REFERENCES users(id),
        client_message_id uuid NOT NULL,
        body text,
        media_asset_id uuid REFERENCES media_assets(id),
        delivered_at timestamptz,
        read_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_messages_client_id UNIQUE (conversation_id, sender_id, client_message_id),
        CONSTRAINT chk_messages_content
          CHECK ((body IS NOT NULL AND length(trim(body)) > 0) OR media_asset_id IS NOT NULL)
      );
      CREATE INDEX idx_messages_conversation_id ON messages(conversation_id, id);
    `);

    // -----------------------------------------------------------------------
    // 9. Safety
    // -----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE user_blocks (
        blocker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (blocker_id, blocked_id),
        CONSTRAINT chk_user_blocks_not_self CHECK (blocker_id <> blocked_id)
      );
      CREATE INDEX idx_user_blocks_blocked ON user_blocks(blocked_id);

      CREATE TABLE reports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        reporter_id uuid NOT NULL REFERENCES users(id),
        target_type text NOT NULL,
        target_user_id uuid REFERENCES users(id),
        target_property_id uuid REFERENCES properties(id),
        target_message_id uuid REFERENCES messages(id),
        reason text NOT NULL,
        comment text,
        evidence_asset_id uuid REFERENCES media_assets(id),
        status text NOT NULL DEFAULT 'open',
        created_at timestamptz NOT NULL DEFAULT now(),
        resolved_at timestamptz,
        CONSTRAINT chk_reports_target_type CHECK (target_type IN ('user','property','message')),
        CONSTRAINT chk_reports_reason CHECK (reason IN ('fraud','duplicate','false_info','inappropriate_content','harassment','other')),
        CONSTRAINT chk_reports_status CHECK (status IN ('open','in_review','resolved','dismissed')),
        CONSTRAINT chk_reports_target CHECK (
          num_nonnulls(target_user_id, target_property_id, target_message_id) = 1
          AND (
            (target_type = 'user' AND target_user_id IS NOT NULL)
            OR (target_type = 'property' AND target_property_id IS NOT NULL)
            OR (target_type = 'message' AND target_message_id IS NOT NULL)
          )
        )
      );
      CREATE INDEX idx_reports_status_created ON reports(status, created_at);
      CREATE INDEX idx_reports_target_user ON reports(target_user_id);
      CREATE INDEX idx_reports_target_property ON reports(target_property_id);
      CREATE INDEX idx_reports_target_message ON reports(target_message_id);
    `);

    // -----------------------------------------------------------------------
    // 10. Notifications and audit
    // -----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind text NOT NULL,
        data jsonb NOT NULL DEFAULT '{}',
        read_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_notifications_kind
          CHECK (kind IN ('new_match','new_message','property_status','property_expiring','identity_result'))
      );
      CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
      CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;

      CREATE TABLE notification_preferences (
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        notification_kind text NOT NULL,
        channel text NOT NULL,
        enabled boolean NOT NULL DEFAULT true,
        PRIMARY KEY (user_id, notification_kind, channel),
        CONSTRAINT chk_notification_preferences_kind
          CHECK (notification_kind IN ('new_match','new_message','property_status','property_expiring','identity_result')),
        CONSTRAINT chk_notification_preferences_channel
          CHECK (channel IN ('in_app','push','email'))
      );

      CREATE TABLE push_devices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform text NOT NULL,
        token text NOT NULL,
        last_seen_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_push_devices_token UNIQUE (token),
        CONSTRAINT chk_push_devices_platform CHECK (platform IN ('ios','android'))
      );
      CREATE INDEX idx_push_devices_user_id ON push_devices(user_id);

      CREATE TABLE audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        action text NOT NULL,
        entity_type text,
        entity_id uuid,
        metadata jsonb NOT NULL DEFAULT '{}',
        ip_address inet,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
      CREATE INDEX idx_audit_logs_actor_created ON audit_logs(actor_user_id, created_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS audit_logs CASCADE;
      DROP TABLE IF EXISTS push_devices CASCADE;
      DROP TABLE IF EXISTS notification_preferences CASCADE;
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP TABLE IF EXISTS reports CASCADE;
      DROP TABLE IF EXISTS user_blocks CASCADE;
      DROP TABLE IF EXISTS messages CASCADE;
      DROP TABLE IF EXISTS conversation_participants CASCADE;
      DROP TABLE IF EXISTS conversations CASCADE;
      DROP TABLE IF EXISTS matches CASCADE;
      DROP TABLE IF EXISTS user_interests CASCADE;
      DROP TABLE IF EXISTS favorite_properties CASCADE;
      DROP TABLE IF EXISTS property_status_history CASCADE;
      DROP TABLE IF EXISTS property_amenities CASCADE;
      DROP TABLE IF EXISTS property_photos CASCADE;
      DROP TABLE IF EXISTS properties CASCADE;
      DROP TABLE IF EXISTS identity_verifications CASCADE;
      DROP TABLE IF EXISTS privacy_requests CASCADE;
      DROP TABLE IF EXISTS privacy_settings CASCADE;
      DROP TABLE IF EXISTS housing_preference_amenities CASCADE;
      DROP TABLE IF EXISTS user_preferred_zones CASCADE;
      DROP TABLE IF EXISTS housing_preferences CASCADE;
      DROP TABLE IF EXISTS roommate_preferences CASCADE;
      DROP TABLE IF EXISTS lifestyle_profiles CASCADE;
      DROP TABLE IF EXISTS profiles CASCADE;
      DROP TABLE IF EXISTS media_assets CASCADE;
      DROP TABLE IF EXISTS legal_acceptances CASCADE;
      DROP TABLE IF EXISTS one_time_tokens CASCADE;
      DROP TABLE IF EXISTS user_sessions CASCADE;
      DROP TABLE IF EXISTS auth_identities CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS amenities CASCADE;
      DROP TABLE IF EXISTS zones CASCADE;
      DROP TABLE IF EXISTS cities CASCADE;
    `);
  }
}
