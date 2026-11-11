gi# MatchRoom Backend

Backend del MVP de MatchRoom construido con **NestJS + TypeORM + PostgreSQL**,
organizado por dominios (DDD ligero) y con el esquema de base de datos versionado
mediante migraciones.

## Requisitos

- Node.js 22+ (probado con Node 26)
- PostgreSQL 15+ con las extensiones `citext` y `pgcrypto`
- Opcional: PostGIS para columnas geográficas reales (ver más abajo)

## Puesta en marcha

```bash
# 1. Dependencias
npm install

# 2. Variables de entorno
cp .env.example .env
# Edita .env con tus credenciales locales de PostgreSQL.
# Nunca subas .env al repositorio.

# 3. Base de datos (si aún no existe)
createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" matchroom

# Alternativa con Docker (lee las variables de .env):
# docker compose up -d postgres

# 4. Aplicar migraciones
npm run migration:run

# 4.1 aplicar seeders
npm run seed

# 5. Levantar la API
npm run start:dev
```

Comprobación rápida:

```bash
curl http://localhost:3000/api/v1/health
# {"status":"ok","database":"up","latencyMs":1,"timestamp":"..."}
```

Toda la configuración vive en `.env`; no hay credenciales, hosts ni puertos
escritos en el código.

## Scripts

| Script                                                              | Descripción                                                 |
| ------------------------------------------------------------------- | ----------------------------------------------------------- |
| `npm run start:dev`                                                 | API en modo watch                                           |
| `npm run build`                                                     | Compila a `dist/`                                           |
| `npm run start:prod`                                                | Ejecuta el build                                            |
| `npm test`                                                          | Tests unitarios (Vitest)                                    |
| `npm run test:e2e`                                                  | Tests de integración contra PostgreSQL                      |
| `npm run test:cov`                                                  | Cobertura                                                   |
| `npm run lint`                                                      | Oxlint con tipos                                            |
| `npm run migration:run`                                             | Aplica migraciones pendientes                               |
| `npm run migration:revert`                                          | Revierte la última migración                                |
| `npm run migration:show`                                            | Estado de migraciones                                       |
| `npm run migration:run:prod`                                        | Aplica migraciones con el build compilado                   |
| `npm run migration:create -- src/common/database/migrations/Nombre` | Crea una migración vacía                                    |
| `npm run data:cities`                                               | Extrae las ciudades del XML de SEPOMEX a `data/cities.json` |
| `npm run data:zones`                                                | Extrae las zonas ligadas a ciudades a `data/zones.json`     |
| `npm run data:extract`                                              | Ejecuta las dos extracciones en orden                       |
| `npm run seed`                                                      | Carga ciudades, zonas y amenidades en la base               |
| `npm run seed:cities`                                               | Carga solo las ciudades                                     |
| `npm run seed:zones`                                                | Carga solo las zonas                                        |
| `npm run seed:amenities`                                            | Carga las amenidades básicas                                |

## Catálogo de ciudades y zonas (SEPOMEX)

`src/common/database/data/CPdescarga.xml` es el archivo oficial de códigos
postales. Para no cargar los ~160k registros completos, el catálogo se genera
en dos pasos:

```bash
npm run data:extract   # genera cities.json y zones.json
npm run migration:run  # crea la columna zones.postal_code
npm run seed           # inserta/actualiza ciudades, zonas y amenidades
```

- `extract-cities.mjs` toma los valores únicos de `d_ciudad` + `d_estado` y
  escribe `cities.json` (659 ciudades).
- `extract-zones.mjs` conserva únicamente las filas que tienen `d_ciudad` y
  genera `zones.json` (más de 54k zonas). El nombre de la zona sale de
  `d_asenta`, el slug se normaliza y el nuevo campo `postalCode` sale de
  `d_codigo`.
- Los seeders son idempotentes: las ciudades se buscan por `(name, state_name)`
  y las zonas se actualizan por `(city_id, slug)`.

Los JSON generados se copian a `dist/` durante `npm run build` para que el
seed también pueda ejecutarse desde el build compilado.

### Endpoints de catálogo

Todos los `GET` usan paginación por offset (`page` empieza en 1, `pageSize`
máximo 100) y devuelven `{ data, meta }`, donde `meta` contiene `page`,
`pageSize`, `total` y `totalPages`.

| Método | Ruta                           | Descripción                                                                                                                           |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/catalog/cities`       | Ciudades activas. Filtros opcionales `stateName` y `postalCode`.                                                                      |
| `GET`  | `/api/v1/catalog/zones`        | Zonas activas. Filtros opcionales `cityId` y `postalCode`; sin `cityId` devuelve zonas de todas las ciudades.                         |
| `GET`  | `/api/v1/catalog/amenities`    | Amenidades activas, ordenadas por nombre.                                                                                             |
| `GET`  | `/api/v1/catalog/autocomplete` | Autocompletado de ciudades y zonas por nombre o código postal. Requiere `q` (mínimo 2 caracteres) y acepta `type=all\|cities\|zones`. |

Ejemplos:

```bash
curl "http://localhost:3000/api/v1/catalog/cities?page=1&pageSize=20"
curl "http://localhost:3000/api/v1/catalog/cities?stateName=Jalisco"
curl "http://localhost:3000/api/v1/catalog/cities?postalCode=06700"
curl "http://localhost:3000/api/v1/catalog/zones?cityId=<uuid>"
curl "http://localhost:3000/api/v1/catalog/zones?postalCode=06700"
curl "http://localhost:3000/api/v1/catalog/amenities?page=1&pageSize=50"
curl "http://localhost:3000/api/v1/catalog/autocomplete?q=roma&type=all"
```

Por ahora estos endpoints son públicos; cuando se integre el guard JWT global
deberán marcarse con `@Public()`.

## Documentación de la API

La API se documenta con **OpenAPI 3** y **Swagger UI** mediante
`@nestjs/swagger`.

| Recurso                  | URL                                   |
| ------------------------ | ------------------------------------- |
| Swagger UI               | `http://localhost:3000/api/docs`      |
| Documento OpenAPI (JSON) | `http://localhost:3000/api/docs-json` |

- La documentación se registra desde `src/config/swagger.ts` y **se desactiva
  automáticamente cuando `NODE_ENV=production`**.
- Incluye el esquema de autenticación Bearer (`access-token`) para los
  endpoints protegidos.
- El plugin de Swagger está activado en `nest-cli.json`, de modo que las
  propiedades de los DTOs se documentan sin repetir `@ApiProperty` en cada
  campo cuando el proyecto se compila con Nest CLI.
- Cada controller nuevo debe llevar `@ApiTags`, y cada operación su resumen,
  `type` de respuesta y códigos de error relevantes (401, 403, 404, 409).
- `test/swagger.e2e-spec.ts` verifica que el documento JSON y la interfaz se
  sirvan correctamente.

## Módulo de propiedades

El módulo `properties` implementa la búsqueda, publicación y gestión de
anuncios, además de favoritos y contactos derivados de conversaciones de renta.
Las fotografías (`property_photos`) no se modificaron en esta iteración.

| Método | Endpoint | Descripción |
| --- | --- | --- |
| `GET` | `/api/v1/properties` | Búsqueda de anuncios `active` con filtros y cursor. |
| `GET` | `/api/v1/properties/map` | Marcadores con ubicación pública, sin dirección ni punto exactos. |
| `GET` | `/api/v1/properties/me` | Anuncios propios, filtrables por estado. |
| `POST` | `/api/v1/properties` | Crea un anuncio en `draft`. |
| `GET` | `/api/v1/properties/:propertyId` | Detalle; la ubicación exacta solo se expone al propietario o a un interesado con conversación `rental` activa. |
| `PATCH` | `/api/v1/properties/:propertyId` | Edita un anuncio propio. |
| `PUT` | `/api/v1/properties/:propertyId/amenities` | Reemplaza las amenidades del anuncio. |
| `POST` | `/api/v1/properties/:propertyId/submit-review` | Valida el anuncio y lo pasa a `in_review`. |
| `PATCH` | `/api/v1/properties/:propertyId/status` | Reserva, renta, pausa o reactiva según las transiciones permitidas. |
| `DELETE` | `/api/v1/properties/:propertyId` | Eliminación lógica con historial. |
| `PUT` | `/api/v1/properties/:propertyId/favorite` | Agrega el anuncio a favoritos (idempotente). |
| `DELETE` | `/api/v1/properties/:propertyId/favorite` | Quita el favorito propio. |
| `GET` | `/api/v1/properties/me/favorites` | Favoritos propios; excluye eliminados y marca `isAvailable`. |
| `GET` | `/api/v1/properties/:propertyId/contacts` | Contactos derivados de conversaciones `rental` del anuncio. |

Filtros de búsqueda disponibles: `cityId`, `zoneIds`, `minPrice`, `maxPrice`,
`type`, `bedrooms`, `bathrooms`, `furnished`, `availableFrom`, `amenityIds`,
`sort` (`newest`, `price_asc`, `price_desc`), `cursor` y `limit`.

### Identidad temporal sin módulo de autenticación

Mientras `accounts/auth` no esté implementado, los endpoints que requieren
usuario leen el UUID desde el header `x-user-id`. Es un transporte temporal:
las reglas de propiedad (propietario, identidad verificada, modo arrendador,
favoritos y contactos) sí se validan en los servicios. Cuando llegue la
autenticación JWT, los controllers deben migrar a `@CurrentUser()`.

## Estructura

```text
src/
├── common/
│   ├── database/
│   │   ├── data-source.ts          # DataSource del CLI de TypeORM
│   │   ├── database.module.ts      # TypeOrmModule.forRoot
│   │   ├── typeorm-options.ts      # Configuración compartida de persistencia
│   │   ├── point.transformer.ts    # (lng,lat) <-> objeto de dominio
│   │   ├── migrations/
│   │   │   └── 1762300800000-InitSchema.ts
│   │   └── index.ts
│   └── filters/
│       ├── database-exception.filter.ts
│       └── index.ts
├── config/
│   ├── env.ts                      # Carga única de `.env` y exporta `env`
│   ├── env.validation.ts           # Validación tipada sin acoplarse a dotenv
│   ├── env.spec.ts
│   └── swagger.ts                  # Swagger UI y documento OpenAPI
├── modules/
│   ├── catalog/                    # cities, zones, amenities
│   ├── accounts/                   # users, auth, sessions, tokens, legal
│   ├── media/                      # media_assets
│   ├── profiles/                   # perfil, lifestyle y preferencias
│   ├── privacy/                    # privacidad y verificación de identidad
│   ├── properties/                 # propiedades, fotos, amenidades, favoritos
│   ├── compatibility/              # cálculo de compatibilidad (sin tablas)
│   ├── matching/                   # intereses y matches
│   ├── chat/                       # conversaciones, participantes, mensajes
│   ├── safety/                     # bloqueos y reportes
│   ├── notifications/              # notificaciones, push y auditoría
│   └── health/                     # GET /api/v1/health
├── app.module.ts
└── main.ts
```

Cada dominio sigue la estructura de la arquitectura (solo con las carpetas que
necesita; las carpetas opcionales se crean cuando aparece la funcionalidad):

```text
modules/<dominio>/
├── presentation/
│   └── controllers/                # HTTP
├── application/
│   ├── dto/                        # DTOs de entrada/salida
│   └── services/                   # casos de uso y reglas de negocio
├── domain/
│   └── entities/
│       ├── <entidad>.entity.ts
│       └── index.ts                # barrel de entidades
├── <dominio>.module.ts             # TypeOrmModule.forFeature([...])
└── index.ts                        # API pública del módulo
```

`compatibility` no declara entidades y expondrá sus cálculos mediante services
exportados. `health` solo contiene su controller y su módulo.

## Dominios y tablas

| Dominio         | Tablas                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog`       | `cities`, `zones`, `amenities`                                                                                                          |
| `accounts`      | `users`, `auth_identities`, `user_sessions`, `one_time_tokens`, `legal_acceptances`                                                     |
| `media`         | `media_assets`                                                                                                                          |
| `profiles`      | `profiles`, `lifestyle_profiles`, `roommate_preferences`, `housing_preferences`, `user_preferred_zones`, `housing_preference_amenities` |
| `privacy`       | `privacy_settings`, `privacy_requests`, `identity_verifications`                                                                        |
| `properties`    | `properties`, `property_photos`, `property_amenities`, `property_status_history`, `favorite_properties`                                 |
| `compatibility` | — (sin tablas)                                                                                                                          |
| `matching`      | `user_interests`, `matches`                                                                                                             |
| `chat`          | `conversations`, `conversation_participants`, `messages`                                                                                |
| `safety`        | `user_blocks`, `reports`                                                                                                                |
| `notifications` | `notifications`, `notification_preferences`, `push_devices`, `audit_logs`                                                               |

Son **34 tablas** de negocio más la tabla interna `migrations`.

## Decisiones de arquitectura

- **Dominios como bounded contexts.** Cada dominio registra sus entidades con
  `TypeOrmModule.forFeature` y exporta su módulo. Las referencias entre
  dominios se hacen por `id` (agregados por identidad), sin relaciones JPA
  cruzadas; las claves foráneas se garantizan en la base de datos.
- **DI por constructor.** `TypeOrmModule.forFeature` solo se declara en el
  módulo dueño de la entidad y los módulos no reexportan `TypeOrmModule`; así
  ningún dominio puede inyectar repositorios ajenos.
- **Las migraciones son la fuente de verdad.** `synchronize` está desactivado.
  El esquema se modifica añadiendo migraciones explícitas; no se usa
  `migration:generate` porque el modelo por identidad no declara relaciones
  TypeORM entre dominios.
- **Snake_case en la base de datos.** `SnakeNamingStrategy` traduce
  `camelCase` de TypeScript a `snake_case` de PostgreSQL.
- **Estados como `text` + `CHECK`.** Se siguen literalmente los `in(...)` del
  documento de entidades; evita migraciones costosas al añadir valores y
  mantiene los tipos union en TypeScript.
- **Índices parciales y restricciones condicionales** reproducidos tal cual:
  cover único por propiedad, conversación única por match, verificación en
  progreso única por usuario, etc.
- **UUID v7 recomendado para mensajes.** El esquema deja
  `DEFAULT gen_random_uuid()`; la capa de aplicación puede generar UUID v7
  para conservar el orden temporal.
- **Auditoría append-only.** `audit_logs` no tiene `updated_at` ni `deleted_at`.
- **Columnas sensibles fuera del SELECT por defecto.** `password_hash`,
  `refresh_token_hash`, `token_hash`, `provider_reference`, `address_exact` y
  `location_exact` usan `select: false` y deben pedirse explícitamente cuando
  una consulta interna realmente las necesita.
- **Errores de base de datos traducidos.** `DatabaseExceptionFilter` convierte
  violaciones de integridad de PostgreSQL (`23505`, `23503`, `23514`) en
  respuestas HTTP seguras, sin filtrar SQL ni nombres de constraints.
- **Prefijo y validación globales.** La API se expone bajo `/api/v1` y usa un
  `ValidationPipe` global con `whitelist` y `forbidNonWhitelisted`.

## Geolocalización

El documento original usa `geography(Point,4326)` (PostGIS), pero una
instalación estándar de PostgreSQL no incluye PostGIS. Para que el MVP funcione
sin dependencias extra, las columnas `properties.location_exact` y
`properties.location_public` usan el tipo nativo `point`:

- Se almacenan como `(longitud, latitud)`.
- `location_public` tiene índice **GiST**.
- `PointTransformer` convierte entre `{ latitude, longitude }` y el formato
  textual de PostgreSQL.

Cuando el entorno tenga PostGIS:

```sql
CREATE EXTENSION postgis;
ALTER TABLE properties
  ALTER COLUMN location_exact TYPE geography(Point,4326)
    USING ST_SetSRID(location_exact::geometry, 4326)::geography,
  ALTER COLUMN location_public TYPE geography(Point,4326)
    USING ST_SetSRID(location_public::geometry, 4326)::geography;
```

El transformer de la aplicación sigue siendo válido porque ambos tipos aceptan
y devuelven `(lng,lat)`.

## Tests

- Unitarios: `src/config/env.spec.ts`, `src/common/database/point.transformer.spec.ts`.
- Integración: `test/database.e2e-spec.ts`, que arranca `AppModule`, comprueba
  `/api/v1/health`, verifica las 34 tablas, el número de entidades registradas,
  que las columnas sensibles queden fuera del SELECT por defecto y que las
  restricciones clave (email `citext`, orden de `matches`) se apliquen.
- Integración de propiedades: `test/properties.e2e-spec.ts` cubre búsqueda,
  mapa, visibilidad de ubicación, ciclo de borrador/revisión/estado,
  favoritos, contactos y eliminación lógica.
- Contrato OpenAPI: `test/swagger.e2e-spec.ts` valida el documento JSON, el
  esquema Bearer y que Swagger UI esté disponible.

Los tests de integración requieren PostgreSQL disponible y las migraciones
aplicadas:

```bash
npm run migration:run
npm run test:e2e
```

## Variables de entorno

Todas son obligatorias y no tienen valores por defecto en el código. El
arranque falla con un mensaje claro si falta alguna o tiene un formato inválido.

| Variable            | Default | Descripción                                                |
| ------------------- | ------- | ---------------------------------------------------------- |
| `NODE_ENV`          | —       | `development`, `test` o `production`                       |
| `PORT`              | —       | Puerto HTTP de la API                                      |
| `CORS_ORIGIN`       | —       | Origen permitido por CORS (`*` o lista separada por comas) |
| `DB_HOST`           | —       | Host de PostgreSQL                                         |
| `DB_PORT`           | —       | Puerto de PostgreSQL                                       |
| `DB_USERNAME`       | —       | Usuario de PostgreSQL                                      |
| `DB_PASSWORD`       | —       | Contraseña de PostgreSQL                                   |
| `DB_DATABASE`       | —       | Nombre de la base de datos                                 |
| `DB_SSL`            | —       | `true`/`false`, TLS para PostgreSQL gestionado             |
| `DB_LOGGING`        | —       | `true`/`false`, log de SQL de TypeORM                      |
| `DB_MIGRATIONS_RUN` | —       | `true`/`false`, ejecutar migraciones al arrancar           |

`.env.example` documenta el formato y contiene valores de relleno, nunca
credenciales reales.
