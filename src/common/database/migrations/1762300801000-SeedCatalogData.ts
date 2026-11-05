import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reference data for the launch city.
 *
 * Kept as a migration so every environment starts with the same catalog.
 * The statements are idempotent (`WHERE NOT EXISTS` / `ON CONFLICT`), so the
 * migration is safe to re-run against a database that already has the rows.
 *
 * Test accounts are intentionally **not** created here: they are seeded by
 * `npm run seed:test`, which refuses to run with NODE_ENV=production.
 */
export class SeedCatalogData1762300801000 implements MigrationInterface {
  name = 'SeedCatalogData1762300801000';

  private readonly city = {
    name: 'Ciudad de México',
    stateName: 'Ciudad de México',
    countryCode: 'MX',
  };

  private readonly zones = [
    { name: 'Roma Norte', slug: 'roma-norte' },
    { name: 'Condesa', slug: 'condesa' },
    { name: 'Del Valle', slug: 'del-valle' },
    { name: 'Narvarte', slug: 'narvarte' },
    { name: 'Coyoacán', slug: 'coyoacan' },
    { name: 'Polanco', slug: 'polanco' },
    { name: 'Escandón', slug: 'escandon' },
    { name: 'Santa Fe', slug: 'santa-fe' },
    { name: 'Centro Histórico', slug: 'centro-historico' },
    { name: 'Doctores', slug: 'doctores' },
  ];

  private readonly amenities = [
    { code: 'agua', name: 'Agua' },
    { code: 'luz', name: 'Luz' },
    { code: 'gas', name: 'Gas' },
    { code: 'internet', name: 'Internet' },
    { code: 'lavadora', name: 'Lavadora' },
    { code: 'estacionamiento', name: 'Estacionamiento' },
    { code: 'amueblado', name: 'Amueblado' },
    { code: 'cocina', name: 'Cocina equipada' },
    { code: 'elevador', name: 'Elevador' },
    { code: 'seguridad', name: 'Seguridad 24/7' },
    { code: 'mascotas', name: 'Mascotas permitidas' },
    { code: 'aire_acondicionado', name: 'Aire acondicionado' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO cities (name, state_name, country_code)
        SELECT $1, $2, $3
        WHERE NOT EXISTS (
          SELECT 1 FROM cities WHERE name = $1 AND state_name = $2
        )
      `,
      [this.city.name, this.city.stateName, this.city.countryCode],
    );

    for (const zone of this.zones) {
      await queryRunner.query(
        `
          INSERT INTO zones (city_id, name, slug)
          SELECT city.id, $1, $2
          FROM cities AS city
          WHERE city.name = $3 AND city.state_name = $4
          ON CONFLICT (city_id, slug) DO NOTHING
        `,
        [zone.name, zone.slug, this.city.name, this.city.stateName],
      );
    }

    for (const amenity of this.amenities) {
      await queryRunner.query(
        `
          INSERT INTO amenities (code, name)
          VALUES ($1, $2)
          ON CONFLICT (code) DO NOTHING
        `,
        [amenity.code, amenity.name],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const amenity of this.amenities) {
      await queryRunner.query(
        `
          DELETE FROM amenities
          WHERE code = $1
            AND NOT EXISTS (
              SELECT 1 FROM property_amenities
              WHERE amenity_id = amenities.id
            )
            AND NOT EXISTS (
              SELECT 1 FROM housing_preference_amenities
              WHERE amenity_id = amenities.id
            )
        `,
        [amenity.code],
      );
    }

    for (const zone of this.zones) {
      await queryRunner.query(
        `
          DELETE FROM zones
          WHERE slug = $1
            AND NOT EXISTS (
              SELECT 1 FROM properties WHERE zone_id = zones.id
            )
            AND NOT EXISTS (
              SELECT 1 FROM user_preferred_zones WHERE zone_id = zones.id
            )
        `,
        [zone.slug],
      );
    }

    await queryRunner.query(
      `
        DELETE FROM cities
        WHERE name = $1 AND state_name = $2
          AND NOT EXISTS (
            SELECT 1 FROM zones WHERE city_id = cities.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM properties WHERE city_id = cities.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM profiles WHERE city_id = cities.id
          )
      `,
      [this.city.name, this.city.stateName],
    );
  }
}
