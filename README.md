# MatchRoom Backend

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

| Script | Descripción |
| --- | --- |
| `npm run start:dev` | API en modo watch |
| `npm run build` | Compila a `dist/` |
| `npm run start:prod` | Ejecuta el build |
| `npm test` | Tests unitarios (Vitest) |
| `npm run test:e2e` | Tests de integración contra PostgreSQL |
| `npm run test:cov` | Cobertura |
| `npm run lint` | Oxlint con tipos |
| `npm run migration:run` | Aplica migraciones pendientes |
| `npm run migration:revert` | Revierte la última migración |
| `npm run migration:show` | Estado de migraciones |
| `npm run migration:run:prod` | Aplica migraciones con el build compilado |
| `npm run migration:create -- src/common/database/migrations/Nombre` | Crea una migración vacía |

## Documentación de la API

La API se documenta con **OpenAPI 3** y **Swagger UI** mediante
`@nestjs/swagger`.

| Recurso | URL |
| --- | --- |
| Swagger UI | `http://localhost:3000/api/docs` |
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

| Dominio | Tablas |
| --- | --- |
| `catalog` | `cities`, `zones`, `amenities` |
| `accounts` | `users`, `auth_identities`, `user_sessions`, `one_time_tokens`, `legal_acceptances` |
| `media` | `media_assets` |
| `profiles` | `profiles`, `lifestyle_profiles`, `roommate_preferences`, `housing_preferences`, `user_preferred_zones`, `housing_preference_amenities` |
| `privacy` | `privacy_settings`, `privacy_requests`, `identity_verifications` |
| `properties` | `properties`, `property_photos`, `property_amenities`, `property_status_history`, `favorite_properties` |
| `compatibility` | — (sin tablas) |
| `matching` | `user_interests`, `matches` |
| `chat` | `conversations`, `conversation_participants`, `messages` |
| `safety` | `user_blocks`, `reports` |
| `notifications` | `notifications`, `notification_preferences`, `push_devices`, `audit_logs` |

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

| Variable | Default | Descripción |
| --- | --- | --- |
| `NODE_ENV` | — | `development`, `test` o `production` |
| `PORT` | — | Puerto HTTP de la API |
| `CORS_ORIGIN` | — | Origen permitido por CORS (`*` o lista separada por comas) |
| `DB_HOST` | — | Host de PostgreSQL |
| `DB_PORT` | — | Puerto de PostgreSQL |
| `DB_USERNAME` | — | Usuario de PostgreSQL |
| `DB_PASSWORD` | — | Contraseña de PostgreSQL |
| `DB_DATABASE` | — | Nombre de la base de datos |
| `DB_SSL` | — | `true`/`false`, TLS para PostgreSQL gestionado |
| `DB_LOGGING` | — | `true`/`false`, log de SQL de TypeORM |
| `DB_MIGRATIONS_RUN` | — | `true`/`false`, ejecutar migraciones al arrancar |

`.env.example` documenta el formato y contiene valores de relleno, nunca
credenciales reales.
