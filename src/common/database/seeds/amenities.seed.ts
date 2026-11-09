import type { DataSource } from 'typeorm';
import { Amenity } from '../../../modules/catalog/domain/entities/index.js';

export interface AmenitySeedRecord {
  code: string;
  name: string;
}

export interface AmenitySeedResult {
  total: number;
  created: number;
  updated: number;
  removed: number;
}

/**
 * Codes inserted by the old launch seed that were replaced by more explicit
 * codes. They are removed when no property/profile references them.
 */
const LEGACY_AMENITY_CODES = new Set(['cocina', 'seguridad', 'mascotas']);

/** Amenidades básicas para una aplicación de renta de departamentos. */
export const BASIC_AMENITIES: readonly AmenitySeedRecord[] = [
  { code: 'agua', name: 'Agua' },
  { code: 'luz', name: 'Luz' },
  { code: 'gas', name: 'Gas' },
  { code: 'internet', name: 'Internet' },
  { code: 'lavadora', name: 'Lavadora' },
  { code: 'secadora', name: 'Secadora' },
  { code: 'estacionamiento', name: 'Estacionamiento' },
  { code: 'amueblado', name: 'Amueblado' },
  { code: 'cocina_equipada', name: 'Cocina equipada' },
  { code: 'refrigerador', name: 'Refrigerador' },
  { code: 'elevador', name: 'Elevador' },
  { code: 'seguridad_24_7', name: 'Seguridad 24/7' },
  { code: 'portero', name: 'Portero' },
  { code: 'intercomunicador', name: 'Intercomunicador' },
  { code: 'mascotas_permitidas', name: 'Mascotas permitidas' },
  { code: 'aire_acondicionado', name: 'Aire acondicionado' },
  { code: 'calefaccion', name: 'Calefacción' },
  { code: 'balcon', name: 'Balcón' },
  { code: 'terraza', name: 'Terraza' },
  { code: 'jardin', name: 'Jardín' },
  { code: 'alberca', name: 'Alberca' },
  { code: 'gimnasio', name: 'Gimnasio' },
  { code: 'area_de_lavado', name: 'Área de lavado' },
  { code: 'cuarto_de_servicio', name: 'Cuarto de servicio' },
  { code: 'cisterna', name: 'Cisterna' },
  { code: 'tinaco', name: 'Tinaco' },
  { code: 'closets', name: 'Clósets' },
  { code: 'piso_laminado', name: 'Piso laminado' },
  { code: 'ventana_exterior', name: 'Ventana exterior' },
];

/**
 * Inserts the basic amenities or updates their display name when it changed.
 * The `code` column is unique, so the seed is idempotent.
 */
export async function seedAmenities(
  dataSource: DataSource,
  amenities: readonly AmenitySeedRecord[] = BASIC_AMENITIES,
): Promise<AmenitySeedResult> {
  return dataSource.transaction(async (manager) => {
    const repository = manager.getRepository(Amenity);
    const existing = await repository.find();
    const byCode = new Map(existing.map((amenity) => [amenity.code, amenity]));

    const pending = amenities.filter((amenity) => !byCode.has(amenity.code));

    if (pending.length > 0) {
      await repository.save(
        repository.create(
          pending.map((amenity) => ({
            code: amenity.code,
            name: amenity.name,
            isActive: true,
          })),
        ),
        { chunk: 100 },
      );
    }

    let updated = 0;

    for (const amenity of amenities) {
      const current = byCode.get(amenity.code);

      if (
        current &&
        (current.name !== amenity.name || current.isActive === false)
      ) {
        await repository.update(
          { id: current.id },
          { name: amenity.name, isActive: true },
        );
        updated += 1;
      }
    }

    const canonicalCodes = new Set(amenities.map((amenity) => amenity.code));
    const legacy = existing.filter(
      (amenity) =>
        LEGACY_AMENITY_CODES.has(amenity.code) &&
        !canonicalCodes.has(amenity.code),
    );

    let removed = 0;

    for (const amenity of legacy) {
      const rows = await manager.query<{ refs: string }[]>(
        `
          SELECT (
            (SELECT COUNT(*) FROM property_amenities WHERE amenity_id = $1)
            + (SELECT COUNT(*) FROM housing_preference_amenities WHERE amenity_id = $1)
          )::text AS refs
        `,
        [amenity.id],
      );

      if (Number(rows[0]?.refs ?? 0) === 0) {
        await repository.delete({ id: amenity.id });
        removed += 1;
      } else {
        await repository.update({ id: amenity.id }, { isActive: false });
      }
    }

    return {
      total: amenities.length,
      created: pending.length,
      updated,
      removed,
    };
  });
}
