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
| `npm run seed:test` | Siembra el catálogo y las cuentas de prueba |

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

## Autenticación (`accounts`)

El módulo `accounts` implementa el núcleo de autenticación con correo y
contraseña:

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Público | Crea la cuenta, el perfil vacío, la privacidad por defecto y las aceptaciones legales |
| `POST` | `/api/v1/auth/login` | Público | Inicia sesión y devuelve access + refresh token |
| `POST` | `/api/v1/auth/refresh` | Público | Rota el refresh token y emite tokens nuevos |
| `POST` | `/api/v1/auth/logout` | Bearer | Revoca la sesión actual |
| `GET` | `/api/v1/auth/me` | Bearer | Devuelve la cuenta autenticada |
| `PATCH` | `/api/v1/auth/password` | Bearer | Cambia la contraseña; revoca las demás sesiones |
| `POST` | `/api/v1/auth/password/forgot` | Público | Solicita un token de recuperación |
| `POST` | `/api/v1/auth/password/reset` | Público | Restablece la contraseña y revoca todas las sesiones |

Detalles de seguridad:

- Access token JWT de corta duración y refresh token JWT de larga duración,
  firmados con secretos distintos (`JWT_ACCESS_SECRET` y
  `JWT_REFRESH_SECRET`). **Nunca se guardan en el repositorio**: viven en
  `.env`.
- El refresh token rota en cada uso. En la base de datos solo se guarda su
  HMAC-SHA256, nunca el token en claro.
- Los tokens de recuperación de contraseña son de un solo uso, se guardan
  hasheados y expiran según `PASSWORD_RESET_TTL_MINUTES`.
- La cuenta se bloquea temporalmente tras `AUTH_MAX_FAILED_ATTEMPTS` intentos
  fallidos, durante `AUTH_LOCK_MINUTES`.
- El guard JWT es global. Las rutas públicas se marcan con `@Public()` y el
  usuario autenticado se obtiene con `@CurrentUser()`.
- En desarrollo, `AUTH_RETURN_RESET_TOKEN=true` devuelve el token de
  recuperación en la respuesta para poder probar el flujo sin proveedor de
  correo. **No debe activarse en producción.**

Pendiente para una siguiente iteración: verificación de correo con reenvío,
inicio de sesión con Google, cierre de sesión en todos los dispositivos,
cambio de modo buscador/arrendador, activación del modo arrendador y
eliminación de cuenta con periodo de gracia.

## Datos semilla

La migración `SeedCatalogData1762300801000` inserta el catálogo de la ciudad
de lanzamiento (Ciudad de México, 10 zonas y 12 amenidades) de forma
idempotente, por lo que se aplica con `npm run migration:run` en cualquier
entorno.

Las cuentas de prueba se crean aparte, con `npm run seed:test`, que también
garantiza el catálogo:

| Correo | Contraseña | Modo |
| --- | --- | --- |
| `seeker@matchroom.test` | `TestPassword123` | Buscador |
| `landlord@matchroom.test` | `TestPassword123` | Arrendador (identidad verificada) |

Cada cuenta recibe perfil, privacidad por defecto y aceptaciones legales. El
seeder es idempotente y se niega a ejecutarse con `NODE_ENV=production`, ya que
usa una contraseña conocida.

## Estructura

```text
src/
├── common/
│   ├── auth/
│   │   ├── decorators/             # @Public, @CurrentUser
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts   # Guard JWT global
│   │   ├── interfaces/
│   │   ├── auth.module.ts
│   │   └── index.ts
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
- Autenticación: `test/accounts.e2e-spec.ts` cubre registro, duplicados,
  validación, login, bloqueo por intentos fallidos, rotación de refresh tokens,
  cambio y recuperación de contraseña, logout y protección de rutas.

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
| `JWT_ACCESS_SECRET` | — | Secreto del access token; mínimo 32 caracteres |
| `JWT_ACCESS_TTL_SECONDS` | — | Vigencia del access token en segundos |
| `JWT_REFRESH_SECRET` | — | Secreto del refresh token; mínimo 32 caracteres y distinto del anterior |
| `JWT_REFRESH_TTL_SECONDS` | — | Vigencia del refresh token en segundos |
| `AUTH_MAX_FAILED_ATTEMPTS` | — | Intentos fallidos antes de bloquear la cuenta |
| `AUTH_LOCK_MINUTES` | — | Duración del bloqueo en minutos |
| `PASSWORD_RESET_TTL_MINUTES` | — | Vigencia del token de recuperación |
| `AUTH_RETURN_RESET_TOKEN` | — | `true`/`false`; devolver el token de recuperación en desarrollo |
| `LEGAL_TERMS_VERSION` | — | Versión vigente de los términos aceptados |
| `LEGAL_PRIVACY_VERSION` | — | Versión vigente del aviso de privacidad |

Genera los secretos JWT con:

```bash
openssl rand -hex 32
```

`.env.example` documenta el formato y contiene valores de relleno, nunca
credenciales reales.
