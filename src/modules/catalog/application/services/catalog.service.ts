import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Amenity, City, Zone } from '../../domain/entities/index.js';
import {
  AmenityResponseDto,
  ListAmenitiesQueryDto,
  PaginatedAmenitiesResponseDto,
} from '../dto/amenity.dto.js';
import {
  AutocompleteItemDto,
  AutocompleteQueryDto,
  AutocompleteType,
  PaginatedAutocompleteResponseDto,
} from '../dto/autocomplete.dto.js';
import {
  CityResponseDto,
  ListCitiesQueryDto,
  PaginatedCitiesResponseDto,
} from '../dto/city.dto.js';
import { PaginationMetaDto } from '../dto/pagination.dto.js';
import {
  ListZonesQueryDto,
  PaginatedZonesResponseDto,
  ZoneResponseDto,
} from '../dto/zone.dto.js';

interface ZoneListRow {
  id: string;
  cityId: string;
  cityName: string;
  stateName: string;
  name: string;
  slug: string;
  postalCode: string | null;
}

interface CountRow {
  total: number;
}

interface AutocompleteRow {
  type: 'city' | 'zone';
  id: string;
  name: string;
  stateName: string;
  cityId: string | null;
  cityName: string | null;
  postalCode: string | null;
}

/**
 * Search conditions for cities. `$1` is the prefix pattern, `$2` the contains
 * pattern. Prefix matches are ranked first.
 */
const CITY_MATCHES_SQL = `
  SELECT
    'city'::text AS type,
    city.id,
    city.name,
    city.state_name AS "stateName",
    NULL::uuid AS "cityId",
    NULL::text AS "cityName",
    NULL::varchar AS "postalCode",
    CASE
      WHEN city.name ILIKE $1 ESCAPE '\\' THEN 0
      WHEN city.state_name ILIKE $1 ESCAPE '\\' THEN 1
      ELSE 2
    END AS rank
  FROM cities city
  WHERE city.is_active = true
    AND (
      city.name ILIKE $2 ESCAPE '\\'
      OR city.state_name ILIKE $2 ESCAPE '\\'
    )
`;

/**
 * Search conditions for zones. `$1` is the prefix pattern, `$2` the contains
 * pattern and `$3` the exact term (used to rank exact postal codes first).
 */
const ZONE_MATCHES_SQL = `
  SELECT
    'zone'::text AS type,
    zone.id,
    zone.name,
    city.state_name AS "stateName",
    zone.city_id AS "cityId",
    city.name AS "cityName",
    zone.postal_code AS "postalCode",
    CASE
      WHEN zone.postal_code = $3 THEN 0
      WHEN zone.name ILIKE $1 ESCAPE '\\' THEN 1
      WHEN zone.postal_code LIKE $1 ESCAPE '\\' THEN 2
      ELSE 3
    END AS rank
  FROM zones zone
  INNER JOIN cities city ON city.id = zone.city_id
  WHERE zone.is_active = true
    AND city.is_active = true
    AND (
      zone.name ILIKE $2 ESCAPE '\\'
      OR zone.postal_code LIKE $2 ESCAPE '\\'
    )
`;

function buildPaginationMeta(
  page: number,
  pageSize: number,
  total: number,
): PaginationMetaDto {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

/** Escapes LIKE wildcards so user input is matched literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(City)
    private readonly citiesRepository: Repository<City>,
    @InjectRepository(Zone)
    private readonly zonesRepository: Repository<Zone>,
    @InjectRepository(Amenity)
    private readonly amenitiesRepository: Repository<Amenity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async listCities(
    query: ListCitiesQueryDto,
  ): Promise<PaginatedCitiesResponseDto> {
    const builder = this.citiesRepository
      .createQueryBuilder('city')
      .where('city.is_active = true');

    if (query.postalCode) {
      builder.andWhere(
        `
          EXISTS (
            SELECT 1
            FROM zones zone
            WHERE zone.city_id = city.id
              AND zone.postal_code = :postalCode
              AND zone.is_active = true
          )
        `,
        { postalCode: query.postalCode },
      );
    }

    if (query.stateName) {
      builder.andWhere('LOWER(city.state_name) = LOWER(:stateName)', {
        stateName: query.stateName,
      });
    }

    const [cities, total] = await builder
      .orderBy('city.state_name', 'ASC')
      .addOrderBy('city.name', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();

    return {
      data: cities.map((city) => this.toCityResponse(city)),
      meta: buildPaginationMeta(query.page, query.pageSize, total),
    };
  }

  /**
   * Lists active zones. `cityId` is optional: when omitted the endpoint
   * returns zones from every active city.
   */
  async listZones(
    query: ListZonesQueryDto,
  ): Promise<PaginatedZonesResponseDto> {
    const builder = this.zonesRepository
      .createQueryBuilder('zone')
      .innerJoin(City, 'city', 'city.id = zone.city_id')
      .select('zone.id', 'id')
      .addSelect('zone.city_id', 'cityId')
      .addSelect('city.name', 'cityName')
      .addSelect('city.state_name', 'stateName')
      .addSelect('zone.name', 'name')
      .addSelect('zone.slug', 'slug')
      .addSelect('zone.postal_code', 'postalCode')
      .where('zone.is_active = true')
      .andWhere('city.is_active = true');

    if (query.cityId) {
      builder.andWhere('zone.city_id = :cityId', { cityId: query.cityId });
    }

    if (query.postalCode) {
      builder.andWhere('zone.postal_code = :postalCode', {
        postalCode: query.postalCode,
      });
    }

    const total = await builder.getCount();

    const rows = await builder
      .orderBy('zone.name', 'ASC')
      .addOrderBy('zone.postal_code', 'ASC')
      .offset((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .getRawMany<ZoneListRow>();

    return {
      data: rows.map((row) => this.toZoneResponse(row)),
      meta: buildPaginationMeta(query.page, query.pageSize, total),
    };
  }

  /**
   * Lists the active amenities available to API clients.
   */
  async listAmenities(
    query: ListAmenitiesQueryDto,
  ): Promise<PaginatedAmenitiesResponseDto> {
    const [amenities, total] = await this.amenitiesRepository
      .createQueryBuilder('amenity')
      .where('amenity.is_active = true')
      .orderBy('amenity.name', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();

    return {
      data: amenities.map((amenity) => this.toAmenityResponse(amenity)),
      meta: buildPaginationMeta(query.page, query.pageSize, total),
    };
  }

  async autocomplete(
    query: AutocompleteQueryDto,
  ): Promise<PaginatedAutocompleteResponseDto> {
    const type: AutocompleteType = query.type;
    const includeCities = type !== 'zones';
    const includeZones = type !== 'cities';
    const escaped = escapeLike(query.q);
    const prefix = `${escaped}%`;
    const contains = `%${escaped}%`;

    const parts: string[] = [];

    if (includeCities) {
      parts.push(CITY_MATCHES_SQL);
    }

    if (includeZones) {
      parts.push(ZONE_MATCHES_SQL);
    }

    const matchesSql = parts.join('\nUNION ALL\n');
    const countParams: unknown[] = includeZones
      ? [prefix, contains, query.q]
      : [prefix, contains];
    const offset = (query.page - 1) * query.pageSize;
    const limitIndex = includeZones ? 4 : 3;
    const listParams: unknown[] = includeZones
      ? [prefix, contains, query.q, query.pageSize, offset]
      : [prefix, contains, query.pageSize, offset];

    const countRows = await this.dataSource.query<CountRow[]>(
      `WITH matches AS (${matchesSql})
       SELECT COUNT(*)::int AS total FROM matches`,
      countParams,
    );
    const total = countRows[0]?.total ?? 0;

    if (total === 0) {
      return {
        data: [],
        meta: buildPaginationMeta(query.page, query.pageSize, total),
      };
    }

    const rows = await this.dataSource.query<AutocompleteRow[]>(
      `WITH matches AS (${matchesSql})
       SELECT type, id, name, "stateName", "cityId", "cityName", "postalCode"
       FROM matches
       ORDER BY rank ASC, name ASC, type ASC
       LIMIT $${limitIndex} OFFSET $${limitIndex + 1}`,
      listParams,
    );

    return {
      data: rows.map((row) => this.toAutocompleteItem(row)),
      meta: buildPaginationMeta(query.page, query.pageSize, total),
    };
  }

  private toCityResponse(city: City): CityResponseDto {
    return {
      id: city.id,
      name: city.name,
      stateName: city.stateName,
      countryCode: city.countryCode,
    };
  }

  private toZoneResponse(row: ZoneListRow): ZoneResponseDto {
    return {
      id: row.id,
      cityId: row.cityId,
      cityName: row.cityName,
      stateName: row.stateName,
      name: row.name,
      slug: row.slug,
      postalCode: row.postalCode,
    };
  }

  private toAmenityResponse(amenity: Amenity): AmenityResponseDto {
    return {
      id: amenity.id,
      code: amenity.code,
      name: amenity.name,
      isActive: amenity.isActive,
    };
  }

  private toAutocompleteItem(row: AutocompleteRow): AutocompleteItemDto {
    return {
      type: row.type,
      id: row.id,
      name: row.name,
      stateName: row.stateName,
      cityId: row.cityId,
      cityName: row.cityName,
      postalCode: row.postalCode,
    };
  }
}
