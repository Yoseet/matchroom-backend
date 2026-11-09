import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the postal code (CP) to zones.
 *
 * The value comes from `d_codigo` in the SEPOMEX `CPdescarga.xml` file. It is
 * nullable because zones created manually (or before this migration) may not
 * have a postal code yet.
 */
export class AddZonePostalCode1762300802000 implements MigrationInterface {
  name = 'AddZonePostalCode1762300802000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE zones ADD COLUMN postal_code varchar(5);
      CREATE INDEX idx_zones_postal_code ON zones(postal_code);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_zones_postal_code;
      ALTER TABLE zones DROP COLUMN IF EXISTS postal_code;
    `);
  }
}
