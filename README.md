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
| `npm run accounts:purge`                                            | Anonimiza cuentas cuyo plazo de eliminación venció          |

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

Estos endpoints son públicos y no hay un guard global de autenticación: cada
controller protegido declara `SessionGuard`. Si más adelante se añade un guard
global, el catálogo y el resto de rutas públicas deberán marcarse con
`@Public()`.

## Documentación de la API

La API se documenta con **OpenAPI 3** y **Swagger UI** mediante
`@nestjs/swagger`.

| Recurso                  | URL                                   |
| ------------------------ | ------------------------------------- |
| Swagger UI               | `http://localhost:3000/api/docs`      |
| Documento OpenAPI (JSON) | `http://localhost:3000/api/docs-json` |

- La documentación se registra desde `src/config/swagger.ts` y **se desactiva
  automáticamente cuando `NODE_ENV=production`**.
- Incluye el esquema de autenticación por cookie de sesión (`session-cookie`,
  `SESSION_COOKIE_NAME`) y conserva el esquema Bearer (`access-token`) para
  clientes que lo necesiten más adelante.
- El plugin de Swagger está activado en `nest-cli.json`, de modo que las
  propiedades de los DTOs se documentan sin repetir `@ApiProperty` en cada
  campo cuando el proyecto se compila con Nest CLI.
- Cada controller nuevo debe llevar `@ApiTags`, y cada operación su resumen,
  `type` de respuesta y códigos de error relevantes (401, 403, 404, 409).
- `test/swagger.e2e-spec.ts` verifica que el documento JSON y la interfaz se
  sirvan correctamente.

## Módulo de cuentas y autenticación

El módulo `accounts` cubre el ciclo de vida de la cuenta: registro, inicio de
sesión con contraseña o Google, sesiones, verificación de correo, recuperación
de contraseña, aceptación legal, cambio de modo, activación de arrendador y
eliminación diferida.

### Sesión por cookie

- El registro, el login y Google crean una sesión y entregan el token en una
  cookie `httpOnly` (`SESSION_COOKIE_NAME`, por defecto `matchroom_session`).
  El cliente no guarda el token ni envía `Authorization`.
- El token es opaco (32 bytes aleatorios en base64url) y la base solo guarda su
  hash SHA-256 en `user_sessions.refresh_token_hash`. La misma cookie funciona
  como refresh token.
- `POST /auth/refresh` **rota** la sesión: revoca la anterior y crea una nueva.
  Un token revocado deja de servir de inmediato.
- La cookie es `SameSite` por diseño. En desarrollo, la página y la API deben
  usar el mismo host (`localhost` con `localhost`, o `127.0.0.1` con
  `127.0.0.1`); si se mezclan, el navegador no envía la cookie. En producción,
  con dominios distintos, usa `SESSION_COOKIE_SAME_SITE=none` +
  `SESSION_COOKIE_SECURE=true` (requiere HTTPS) o publica la API bajo el mismo
  dominio con un proxy `/api`.
- `CORS_ORIGIN` exige orígenes explícitos y la API habilita credenciales; `*`
  se rechaza al arrancar.

### Endpoints

Todas las rutas viven bajo `/api/v1`. «Sesión» indica si requieren la cookie.

| Método   | Ruta                   | Sesión | Descripción                                                              | Respuestas      |
| -------- | ---------------------- | ------ | ------------------------------------------------------------------------ | --------------- |
| `POST`   | `/auth/register`       | No     | Crea la cuenta, el perfil inicial, la privacidad y las aceptaciones.     | 201, 409, 429   |
| `POST`   | `/auth/login`          | No     | Inicia sesión con correo y contraseña.                                   | 200, 401, 429   |
| `POST`   | `/auth/google`         | No     | Valida el ID token de Google; `linkPassword` si el correo ya existe.     | 200, 401, 409, 503 |
| `POST`   | `/auth/refresh`        | Cookie | Rota la sesión y devuelve el usuario.                                    | 200, 401       |
| `GET`    | `/auth/me`             | Sí     | Usuario de la sesión actual.                                             | 200, 401       |
| `POST`   | `/auth/logout`         | Sí     | Revoca la sesión actual y limpia la cookie.                              | 204, 401       |
| `POST`   | `/auth/logout-all`     | Sí     | Revoca todas las sesiones de la cuenta.                                  | 204, 401       |
| `POST`   | `/auth/email/verify`   | No     | Consume el token de verificación de correo.                              | 204, 400, 429  |
| `POST`   | `/auth/email/resend`   | Sí     | Genera y envía un enlace de verificación nuevo.                          | 204, 401, 429  |
| `POST`   | `/auth/password/forgot`| No     | Solicita el enlace de recuperación (responde 204 siempre).               | 204, 429       |
| `POST`   | `/auth/password/reset` | No     | Cambia la contraseña y revoca todas las sesiones.                        | 204, 400, 429  |
| `PATCH`  | `/auth/password`       | Sí     | Cambia la contraseña conociendo la actual.                               | 204, 401, 429  |
| `POST`   | `/auth/legal/accept`   | Sí     | Registra términos y aviso de privacidad (sesiones ya existentes).        | 204, 400       |
| `PATCH`  | `/auth/me/mode`        | Sí     | Cambia entre `seeker` y `landlord`.                                      | 200, 403       |
| `POST`   | `/auth/me/landlord`    | Sí     | Habilita el modo arrendador (exige identidad verificada).                | 200, 403       |
| `DELETE` | `/auth/me`             | Sí     | Agenda la eliminación con 30 días de gracia.                             | 200, 400, 401  |

`GET /auth/me` y las respuestas de sesión devuelven
`{ user: { id, email, activeMode, emailVerified, firstName, lastName } }`.
Los endpoints `204` no tienen cuerpo. `DELETE /auth/me` devuelve
`{ scheduledAt }`.

### Reglas de negocio

- **Registro transaccional.** Crea `users`, las primeras filas de `profiles` y
  `privacy_settings`, las dos aceptaciones legales (`terms` y `privacy`,
  versión `2026-01`, con IP y user-agent) y el token de verificación. Exige
  `acceptTerms=true` y `adultDeclared=true`.
- **Contraseñas.** bcrypt con coste 12; mínimo 8 caracteres, máximo 72, con al
  menos una letra y un número.
- **Tokens de un solo uso.** La verificación de correo vence en 24 horas y la
  recuperación en 1 hora. El consumo es un `UPDATE ... RETURNING` atómico, así
  que dos peticiones concurrentes no pueden reutilizar el mismo token. Generar
  uno nuevo invalida los anteriores no usados del mismo propósito.
- **Bloqueo por intentos.** Tras 5 fallos la cuenta se bloquea 15 minutos. El
  error de login es siempre genérico para no revelar si el correo existe.
- **Recuperación.** `password/forgot` responde 204 aunque el correo no exista.
  `password/reset` revoca todas las sesiones y desbloquea la cuenta.
- **Google.** Verifica el ID token contra `GOOGLE_CLIENT_ID`. Si el `sub` ya
  está vinculado, inicia sesión; si el correo pertenece a una cuenta con
  contraseña, exige `linkPassword` (o una sesión válida) antes de vincular y
  nunca crea una segunda cuenta con el mismo correo. Sin `GOOGLE_CLIENT_ID`
  responde 503.
- **Modos.** `seeker` siempre está disponible. `landlord` exige
  `landlord_enabled_at`, y habilitarlo requiere `identity_status='verified'` e
  `identity_verified_at`.
- **Eliminación.** `DELETE /auth/me` pide la contraseña (o `confirm: true` en
  cuentas solo Google), marca `pending_deletion` con 30 días de gracia, revoca
  sesiones, pausa anuncios `active`/`reserved`, deshace matches activos y
  cierra conversaciones. La anonimización final la ejecuta
  `npm run accounts:purge` (idempotente; prográmalo a diario con cron, Task
  Scheduler o un job del contenedor): reemplaza el correo por
  `deleted-<id>@deleted.matchroom.invalid` y borra credenciales, identidades,
  sesiones, tokens y datos personales.
- **Límite de peticiones.** Los endpoints sensibles usan un contador en memoria
  por proceso (registro 5/15 min, login 10/15 min, reenvío 3/15 min…). Con
  varias instancias cada una lleva su propio conteo; para producción
  multiinstancia conviene un almacén compartido (Redis).

### Correo

- Con `SMTP_HOST` y `MAIL_FROM` configurados, los correos salen por nodemailer
  (`SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`).
- Sin SMTP en `development`/`test`, el mensaje completo (con el enlace y el
  token) se escribe en el log del backend. En la base solo queda el hash, así
  que el log es la única forma de probar el flujo localmente.
- Sin SMTP en `production`, los endpoints de correo responden 503 en lugar de
  simular el envío.
- `APP_PUBLIC_URL` construye los enlaces
  `/verificar-correo?token=...` y `/restablecer-contrasena?token=...` que abre
  el frontend.

### Estado de implementación

| # | Funcionalidad                          | Estado      | Nota                                                                                                 |
| - | -------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| 1 | Registro con correo y contraseña       | Implementado | Validado contra PostgreSQL y desde la UI.                                                            |
| 2 | Login, bloqueo y sesión                | Implementado | 5 fallos → 15 minutos; cookie `httpOnly`.                                                            |
| 3 | Login con Google y vinculación         | Parcial     | Código completo; sin `GOOGLE_CLIENT_ID` responde 503, así que no se validó con una credencial real.   |
| 4 | Refresh, logout y logout-all           | Implementado | Rotación real: el token anterior queda revocado.                                                     |
| 5 | Verificación de correo y reenvío       | Implementado | La entrega real depende de SMTP; en desarrollo el enlace va al log.                                   |
| 6 | Recuperación y cambio de contraseña    | Implementado | Tokens de un solo uso; el reset revoca sesiones.                                                     |
| 7 | Aceptación legal                       | Implementado | Dos documentos versionados con IP y user-agent.                                                      |
| 8 | Cambio de modo                         | Implementado | `landlord` bloqueado hasta habilitarlo.                                                              |
| 9 | Activación de arrendador               | Parcial     | Implementada, pero inalcanzable hasta que exista el módulo de verificación de identidad que marque `identity_status='verified'`. |
| 10 | Eliminación de cuenta                 | Implementado | 30 días de gracia + `npm run accounts:purge` para la anonimización final.                             |
| 11 | Pantallas de cuenta en el frontend    | Implementado | `/verificar-correo`, `/recuperar-contrasena`, `/restablecer-contrasena`; no se bloquea el onboarding por correo sin verificar. |

Pendiente fuera de este módulo: verificación de identidad real (KYC),
autenticación en dos pasos, notificaciones de inicio de sesión, límite de
peticiones distribuido, entrega de correo sin SMTP y migrar `properties` del
header temporal `x-user-id` a la sesión.

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

### Identidad en `properties`: header temporal

`accounts` y `profiles` ya resuelven la identidad con la sesión
(`SessionGuard` + `@CurrentUserId()`). Los controllers de `properties` siguen
leyendo el UUID del header `x-user-id` como transporte temporal: las reglas de
propiedad (propietario, identidad verificada, modo arrendador, favoritos y
contactos) sí se validan en los servicios, pero cualquier cliente puede enviar
otro UUID. Es la migración pendiente más importante antes de exponer estos
endpoints en producción: deben usar `SessionGuard` y `@CurrentUserId()` de
`src/common/auth`.

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

- Unitarios: `src/config/env.spec.ts`,
  `src/common/database/point.transformer.spec.ts` y
  `src/modules/accounts/application/services/auth.service.spec.ts` (registro,
  login, bloqueo, rotación de sesión, tokens de un solo uso, modos y borrado).
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

Las variables de infraestructura son obligatorias y no tienen valores por
defecto en el código. El arranque falla con un mensaje claro si falta alguna o
tiene un formato inválido. Las marcadas como opcionales activan funciones
(Google, SMTP) o usan un valor por defecto seguro.

| Variable                   | Default              | Descripción                                                          |
| -------------------------- | -------------------- | -------------------------------------------------------------------- |
| `NODE_ENV`                 | —                    | `development`, `test` o `production`                                 |
| `PORT`                     | —                    | Puerto HTTP de la API                                                |
| `CORS_ORIGIN`              | —                    | Orígenes permitidos por CORS (lista separada por comas; nunca `*`)   |
| `DB_HOST`                  | —                    | Host de PostgreSQL                                                   |
| `DB_PORT`                  | —                    | Puerto de PostgreSQL                                                 |
| `DB_USERNAME`              | —                    | Usuario de PostgreSQL                                                |
| `DB_PASSWORD`              | —                    | Contraseña de PostgreSQL                                             |
| `DB_DATABASE`              | —                    | Nombre de la base de datos                                           |
| `DB_SSL`                   | —                    | `true`/`false`, TLS para PostgreSQL gestionado                       |
| `DB_LOGGING`               | —                    | `true`/`false`, log de SQL de TypeORM                                |
| `DB_MIGRATIONS_RUN`        | —                    | `true`/`false`, ejecutar migraciones al arrancar                     |
| `SESSION_COOKIE_NAME`      | `matchroom_session`  | Nombre de la cookie de sesión                                        |
| `SESSION_COOKIE_SAME_SITE` | `lax`                | `lax`, `strict` o `none`; con dominios distintos usa `none` + HTTPS  |
| `SESSION_COOKIE_SECURE`    | `true` en producción | Solo enviar la cookie por HTTPS                                      |
| `SESSION_TTL_HOURS`        | `168`                | Duración de la sesión en horas (1–2160)                              |
| `APP_PUBLIC_URL`           | `http://localhost:5173` | Origen del frontend usado en los enlaces de correo                |
| `GOOGLE_CLIENT_ID`         | — (opcional)         | Sin este valor `/auth/google` responde 503                           |
| `MAIL_FROM`                | — (opcional)         | Remitente de los correos; junto a `SMTP_HOST` activa el envío real   |
| `SMTP_HOST`                | — (opcional)         | Servidor SMTP                                                        |
| `SMTP_PORT`                | `587` si hay SMTP    | Puerto SMTP                                                          |
| `SMTP_SECURE`              | `false`              | `true`/`false`, TLS directo (normalmente `465`)                      |
| `SMTP_USER`                | — (opcional)         | Usuario SMTP                                                         |
| `SMTP_PASSWORD`            | — (opcional)         | Contraseña SMTP                                                      |

Sin SMTP en desarrollo, los enlaces de verificación y recuperación se escriben
en el log del backend. En producción, sin SMTP, esos endpoints responden 503.

`.env.example` documenta el formato y contiene valores de relleno, nunca
credenciales reales.
