# MatchRoom Backend — Arquitectura y guía de desarrollo

**Documento:** `BACKEND_ARCHITECTURE.md`
**Stack:** NestJS + TypeScript + TypeORM + PostgreSQL (con `citext`; `point` nativo y PostGIS opcional)
**Arquitectura:** modular por dominios, con separación de responsabilidades.
**Fuente de verdad de datos:** `matchroom_database_entities_mvp_v1_1.md` (tablas y columnas) y `matchroom_backend_schema_v1_1.md` (reglas de integridad y comportamiento).

---

## 1. Objetivo, módulos y estructura

**Objetivo:** un backend modular, fácil de mantener y extender, con Dependency Injection, responsabilidades claras y sin capas innecesarias. Debe poder evolucionar hacia DDD más completo solo si la complejidad lo justifica.

**IMPORTANTE PARA EL AGENTE:** antes de modificar cualquier archivo, inspecciona la estructura actual, dependencias, configuración, entidades y migraciones. No asumas que el código existente sigue los ejemplos de este documento: adapta las convenciones a lo que ya existe, preserva la funcionalidad y no rompas migraciones ni relaciones.

### 1.1 Módulos

Cada módulo es dueño de sus entidades y de su lógica.

| Módulo | Responsabilidad | Entidades propias |
|---|---|---|
| `catalog` | Ciudades, zonas y servicios | `cities`, `zones`, `amenities` |
| `accounts` | Registro, login, sesiones, tokens, términos, modo buscador/arrendador, eliminación de cuenta | `users`, `auth_identities`, `user_sessions`, `one_time_tokens`, `legal_acceptances` |
| `media` | Subida, validación y moderación de imágenes | `media_assets` |
| `profiles` | Perfil, hábitos, preferencias y completitud | `profiles`, `lifestyle_profiles`, `roommate_preferences`, `housing_preferences`, `user_preferred_zones`, `housing_preference_amenities` |
| `privacy` | Ajustes de privacidad, solicitudes ARCO y verificación de identidad | `privacy_settings`, `privacy_requests`, `identity_verifications` |
| `properties` | Anuncios, fotos, estados, búsqueda y favoritos | `properties`, `property_photos`, `property_amenities`, `property_status_history`, `favorite_properties` |
| `compatibility` | Cálculo de compatibilidad y recomendaciones. **Sin tablas.** | — |
| `matching` | Descubrir roomies, intereses y matches | `user_interests`, `matches` |
| `chat` | Conversaciones, mensajes y tiempo real | `conversations`, `conversation_participants`, `messages` |
| `safety` | Bloqueos y reportes | `user_blocks`, `reports` |
| `notifications` | Notificaciones, preferencias, push y auditoría | `notifications`, `notification_preferences`, `push_devices`, `audit_logs` |

`compatibility` es un módulo propio (y no parte de `matching`) porque lo usan `matching` y `properties` para ordenar resultados; si viviera dentro de `matching`, `properties` y `matching` se necesitarían mutuamente.

### 1.2 Estructura interna de un módulo

```text
profiles/
├── presentation/
│   ├── controllers/        # HTTP
│   └── gateways/           # solo si hay WebSocket (chat)
├── application/
│   ├── dto/
│   ├── services/
│   ├── listeners/          # handlers de eventos de dominio
│   └── jobs/               # cron y procesadores de cola
├── domain/
│   └── entities/
│       └── index.ts        # barrel de entidades
├── profiles.module.ts
└── index.ts                # API pública del módulo
```

- Crea **solo** los archivos y carpetas que la funcionalidad necesite.
- Varios controllers o services por módulo son válidos cuando responden a responsabilidades distintas; no los dividas por cantidad de endpoints ni crees un service por método.
- `index.ts` del módulo exporta únicamente lo que otros módulos pueden usar: el módulo, los services exportados y los eventos. **Otros módulos importan desde ahí**, no desde rutas internas.

---

## 2. Capas y responsabilidades

| Capa | Qué contiene | Debe hacer | No debe hacer |
|---|---|---|---|
| **Presentation** | Controllers, gateways | Definir endpoints, recibir DTOs validados, obtener el usuario autenticado, delegar al service | Lógica de negocio, consultas TypeORM, instanciar services |
| **Application** | DTOs, services, listeners, jobs | Casos de uso, reglas de negocio, transacciones, autorización por recurso, armar los DTOs de respuesta, lanzar excepciones HTTP de Nest | Devolver entidades, escribir en entidades de otros módulos |
| **Domain** | Entidades TypeORM | Describir tablas y relaciones | Dependencias HTTP, DTOs, campos agregados "por conveniencia" de otro módulo |

**DTOs**

- Entrada con `class-validator` y `class-transformer`; crear y actualizar tienen DTOs distintos si sus reglas difieren (`PartialType` solo si las reglas son las mismas).
- **Toda respuesta pasa por un DTO de respuesta.** Una entidad nunca sale por HTTP.
- Nunca se exponen: `password_hash`, hashes de tokens y de refresh, `provider_reference`, `ip_address`, ni `address_exact` y `location_exact` fuera de las reglas de propiedades.

**Services**

- Una responsabilidad por service (por ejemplo `ProfilesService`, `ProfileCompletenessService`, `PublicProfilesService`).
- La autorización por recurso (¿es dueño del anuncio?, ¿participa en la conversación?) se valida en el service. Los guards no la sustituyen.

**Entidades:** en esta etapa son entidades TypeORM dentro de `domain/entities`. No se crean entidades de dominio puras separadas hasta que la complejidad lo justifique.

---

## 3. Dependency Injection y dependencias entre módulos

### 3.1 Reglas de DI

- Inyección por constructor. Nunca `new` sobre controllers, services o providers de Nest.
- Cada componente se registra en `providers` de su módulo; solo se exporta (`exports`) lo que otros módulos necesitan.
- `TypeOrmModule.forFeature([...])` se declara **solo en el módulo dueño** de cada entidad.
- El módulo que consume importa el módulo que exporta.

### 3.2 Reglas de dependencia entre módulos

1. **Escritura:** solo el módulo dueño escribe en sus entidades. Los demás llaman a un service exportado.
2. **Lectura puntual:** se pide al service exportado del dueño, con consultas que devuelvan solo los campos necesarios, no la entidad completa.
3. **Lectura masiva o con joins** (descubrimiento de roomies, búsqueda de propiedades, compatibilidad): un `*-query.service.ts` del módulo consumidor puede unir tablas de otros módulos usando `DataSource` o `EntityManager` y `createQueryBuilder(Entidad, alias)`. Es **solo lectura**, sin `forFeature` ni repositorios ajenos, y las entidades se importan del barrel `domain/entities` del dueño (no del `index.ts` del módulo, para evitar importaciones circulares).
4. **`User` es la única entidad de lectura libre** para cualquier módulo (identidad transversal). Solo `accounts` la modifica.
5. **Ciclos:** `forwardRef` está prohibido como primera solución. Si dos módulos se necesitan, la notificación "hacia arriba" va por **eventos**.
6. **Eventos** (`@nestjs/event-emitter`): se emiten **después** de confirmar la transacción, el payload lleva IDs (no entidades) y los listeners son idempotentes. Las clases de eventos viven en `common/events`.

### 3.3 Quién usa a quién

| Caso | Mecanismo |
|---|---|
| Registro crea `profiles` y `privacy_settings` | `accounts` → `ProfilesService.createEmpty(userId, manager)` y `PrivacyService.createDefaults(userId, manager)`; síncrono, misma transacción |
| Match mutuo crea la conversación | `matching` → `ChatService.createRoommateConversation(...)`; síncrono, misma transacción |
| Ordenar por compatibilidad | `properties` y `matching` → `CompatibilityService`; síncrono |
| Bloquear a un usuario | `safety` emite `UserBlocked` → `matching` deshace el match y `chat` cierra la conversación |
| Eliminar cuenta | `accounts` emite `AccountDeletionRequested` → `properties` pausa anuncios, `matching` deshace matches, `chat` cierra conversaciones |
| Crear notificaciones | `matching`, `chat`, `properties` y `privacy` emiten eventos → `notifications` escucha y crea la notificación |
| Auditoría | Los módulos llaman a `AuditService` (exportado por `notifications`) |
| Perfil o propiedad modificados | Eventos `ProfileUpdated` y `PropertyUpdated`; hoy sin listeners, listos para una futura caché de compatibilidad |

`notifications` no importa ningún otro módulo de dominio: es una hoja del grafo.

---

## 4. Persistencia con TypeORM

**Repositorios:** se usan directamente los de TypeORM. No se crean interfaces ni clases `Repository` personalizadas, ni Unit of Work, salvo que la misma consulta compleja se repita en dos o más lugares. Las búsquedas complejas usan `QueryBuilder`.

**Entidades y esquema**

- Las entidades reflejan exactamente `matchroom_database_entities_mvp_v1_1.md`. No agregues columnas ni tablas sin actualizar ese documento.
- Una sola estrategia de nombres: `SnakeNamingStrategy` (o `name:` explícito en cada columna), nunca mezcladas.
- El ORM **no** genera todo el esquema. Se escriben **a mano en SQL dentro de las migraciones**: `CHECK`, índices parciales, índice `GIST`, columnas geográficas, el tipo `citext` y las extensiones necesarias. No uses `migration:generate` sin revisar su resultado: no refleja esas restricciones.
- Ojo con los tipos: `numeric` llega como `string` desde PostgreSQL (usa un `transformer` o trátalo como string hasta el DTO). Las columnas geográficas usan `point` nativo y `PointTransformer`; las consultas PostGIS, si se habilitan, van con SQL crudo.
- IDs: `@PrimaryGeneratedColumn('uuid')`; `messages.id` es UUID v7 generado en la aplicación.

**Columnas sensibles:** márcalas con `select: false` (`password_hash`, hashes de tokens, `refresh_token_hash`, `address_exact`, `location_exact`, `provider_reference`) y cárgalas con `addSelect` solo donde se necesiten.

**Transacciones**

```typescript
async createMatch(fromId: string, toId: string) {
  const match = await this.dataSource.transaction(async (manager) => {
    // 1. guardar interés  2. buscar interés inverso
    // 3. insertar el match con IDs normalizados (user_a_id < user_b_id) usando .orIgnore()
    // 4. this.chatService.createRoommateConversation(match, manager)
    return match;
  });
  this.eventEmitter.emit('match.created', { matchId: match.id }); // después del commit
  return match;
}
```

- Los services que participan en una transacción reciben `manager?: EntityManager` y usan `manager.getRepository(...)`.
- **Transacción obligatoria en:** registro; crear match y conversación; enviar mensaje (más `last_message_at`); cambio de estado de propiedad (más historial, con `lock: { mode: 'pessimistic_write' }`); verificación de identidad (`identity_verifications` y `users`); reasignar un token push.
- El consumo de un token de un solo uso es un `UPDATE ... WHERE used_at IS NULL AND expires_at > now() RETURNING`, no un "leer y luego escribir".

**Concurrencia:** apóyate en las restricciones únicas y en `ON CONFLICT DO NOTHING` (`orIgnore()`). Captura la violación `23505` y respóndela como `409`.

**Paginación:** por cursor (keyset) en listados que crecen: mensajes por `id`, propiedades por `created_at` e `id`, notificaciones, matches. Offset solo en catálogos.

**Prohibido:** cargar todos los usuarios en memoria para ordenarlos, N+1 (usa joins o `relations` selectivas), `find()` sin límite en tablas que crecen y `synchronize: true`.

---

## 5. Flujo de petición y convenciones de API

```text
Request → Guard JWT (global) → ValidationPipe (DTO) → Controller → Service → TypeORM
        → Service arma el DTO de respuesta → Controller → Response
```

Los gateways WebSocket, listeners de eventos y jobs son otros puntos de entrada y **reutilizan los mismos services**; no duplican lógica de negocio.

| Convención | Regla |
|---|---|
| Prefijo | `/api/v1` |
| Autenticación | Guard JWT **global**; las rutas abiertas llevan `@Public()`. El usuario sale de `@CurrentUser()`; nunca se confía en un `userId` del body. |
| Recursos del usuario actual | Bajo `/me/...`; los demás recursos por id |
| Listados paginados | `{ data: [...], nextCursor: string \| null }` |
| Errores | `{ statusCode, error, message, details? }` |
| Fechas e IDs | ISO 8601 en UTC; UUID |

---

## 6. Estructura de `src`, `main.ts` y `app.module.ts`

```text
src/
├── main.ts
├── app.module.ts
├── config/
│   └── env.ts
├── common/
│   ├── database/           # database.module.ts, data-source.ts
│   ├── auth/               # JwtAuthGuard, @Public, @CurrentUser, ActiveUserGuard, VerifiedIdentityGuard
│   ├── filters/            # filtro global de excepciones
│   └── events/             # clases de eventos de dominio
└── modules/
    ├── catalog/  accounts/  media/  profiles/  privacy/  properties/
    ├── compatibility/  matching/  chat/  safety/  notifications/
```

**`main.ts`:** crea la app con `NestFactory`; configura el prefijo global, CORS, `helmet`, `ValidationPipe` global, el filtro global de excepciones, `enableShutdownHooks()` y Swagger (desactivado en producción). Sin lógica de negocio.

**`app.module.ts`:** punto de composición. Importa la configuración, `DatabaseModule`, `EventEmitterModule.forRoot()`, `ScheduleModule.forRoot()` (jobs de expiración y de eliminación de cuentas), la cola (BullMQ) cuando se necesite y los módulos de dominio. No registra services de dominio.

**`app.controller.ts` y `app.service.ts`:** elimínalos o déjalos solo como health check. Nada propio de MatchRoom va ahí.

---

## 7. Configuración y conexión a PostgreSQL

Esta sección importa porque pueden existir archivos de configuración duplicados o con valores escritos a mano.

| Archivo | Responsabilidad |
|---|---|
| `.env` | Valores reales. **No se versiona.** |
| `.env.example` | Plantilla versionada con **todas** las variables requeridas, sin credenciales reales (`NODE_ENV`, `PORT`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, secretos JWT y las demás que use el proyecto). |
| `config/env.ts` | **Único punto** que lee, valida y tipa las variables. Falla al arrancar si falta una obligatoria o es inválida. No contiene credenciales. Si el proyecto usa `@nestjs/config`, mantén esa única estrategia; no crees dos sistemas de lectura. |
| `common/database/database.module.ts` | `TypeOrmModule.forRoot` con valores de `env.ts`; `autoLoadEntities: true`, `synchronize: false`, estrategia de nombres. Una sola conexión. |
| `common/database/data-source.ts` | DataSource para la CLI (migraciones). Importa la configuración de `env.ts`; no es una segunda fuente de verdad. |

**Migraciones**

- Todo cambio de esquema es una migración nueva y versionada. Nunca `synchronize`.
- No edites una migración ya ejecutada en un entorno compartido.
- La primera migración crea la extensión `citext`; `postgis` solo si el entorno lo requiere.
- Prueba `up` y `down` sobre una base vacía.
- Antes de cambiar entidades, revisa las migraciones y relaciones existentes.

No asumas que `env.ts` está mal solo porque contiene propiedades de configuración: su función es centralizar y validar, no guardar secretos.

---

## 8. Validación y manejo de errores

```typescript
app.useGlobalPipes(
  new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
);
```

**Validación**

- IDs con `@IsUUID()`; enums con `@IsIn(...)` o `@IsEnum(...)` usando los valores de los `CHECK` del esquema.
- Las reglas del esquema se validan antes de llegar a la base: contraseña de 8 o más caracteres con letras y números, `bio` hasta 500, niveles de 1 a 5, `budget_min <= budget_max`, `min_age <= max_age`.

**Excepciones**

- Los services lanzan excepciones HTTP de Nest (`NotFoundException`, `ForbiddenException`, `ConflictException`, `BadRequestException`).
- Si un recurso existe pero el usuario **no debe saberlo** (perfil oculto por privacidad, alguien que lo bloqueó), responde `404`, no `403`.
- El login no revela si un correo existe. Lo mismo en recuperación de contraseña.

**Filtro global de excepciones**

| Origen | Respuesta |
|---|---|
| `QueryFailedError` `23505` (único) | `409 Conflict` |
| `23503` (llave foránea) | `409 Conflict` |
| `23514` (`CHECK`) | `400 Bad Request` |
| Cualquier otro error de base de datos | `500` genérico; el detalle solo se registra en logs |

Nunca devuelvas SQL, nombres de restricciones ni mensajes internos de PostgreSQL. No registres contraseñas, tokens ni datos de verificación.

---

## 9. Testing

Jest, con los `.spec.ts` junto al archivo y las pruebas E2E en `test/`.

- Las pruebas de integración y E2E corren contra **PostgreSQL real** (Docker o testcontainers). SQLite y `pg-mem` no soportan `citext`, columnas `point` ni los `CHECK` e índices parciales del esquema.
- Los mocks de repositorio se usan solo para lógica pura. No generes pruebas vacías o triviales.

**Prioridades para MatchRoom**

1. `CompatibilityService`: funciones puras, traslape de presupuesto y exclusión por criterios excluyentes.
2. Transiciones de estado de propiedades: válidas, inválidas y registro de historial.
3. Match: interés mutuo, dos intereses simultáneos que producen un solo match, bloqueo.
4. Visibilidad y privacidad: la consulta de usuarios descubribles y el serializador de perfiles.
5. Autenticación: bloqueo tras 5 intentos, tokens de un solo uso, rotación de refresh tokens, eliminación de cuenta.
6. Chat: idempotencia por `client_message_id`, pertenencia a la conversación, conversación cerrada.
7. Autorización por recurso, por ejemplo quién puede ver `address_exact`.

Cada bug corregido agrega una prueba que lo reproduce.

---

## 10. Swagger / OpenAPI

- `@nestjs/swagger` con su plugin de la CLI activado en `nest-cli.json` para generar las propiedades de los DTOs sin decorarlas a mano. Documentación en `/api/docs`, desactivada en producción.
- `addBearerAuth()` en la configuración global.
- `@ApiTags` por módulo; `@ApiBearerAuth` en los controllers protegidos.
- Los DTOs de respuesta siempre tipados en la operación (`type`); un DTO genérico para el listado paginado.
- Documenta solo los códigos de error relevantes por operación (401, 403, 404, 409). Mantén la documentación al día con cada endpoint nuevo.

---

## 11. Convenciones generales

- TypeScript estricto; `any` solo con justificación.
- Archivos en kebab-case con sufijo (`.service.ts`, `.controller.ts`, `.dto.ts`, `.entity.ts`, `.module.ts`, `.spec.ts`); clases en PascalCase; variables y métodos en camelCase.
- Sin credenciales escritas en código ni configuración duplicada.
- Sin dependencias circulares (ver 3.2).
- Sin consultas de base de datos fuera de services (y query services).

---

## 12. Reglas de trabajo para el agente de IA

1. Antes de modificar archivos, analiza la estructura y el código existente.
2. Revisa `package.json`, dependencias, versiones y scripts.
3. Revisa `main.ts`, `app.module.ts`, `config/env.ts` y `common/database`.
4. Revisa entidades y migraciones antes de tocarlas.
5. **No inventes funcionalidades, tablas ni columnas** que no estén en los requisitos y en `matchroom_database_entities_mvp_v1_1.md`. Si falta algo, repórtalo en lugar de improvisar.
6. Mantén la arquitectura modular y la dirección de dependencias de la sección 3. No accedas a repositorios de otros módulos.
7. Crea controllers, services y DTOs dentro de su módulo y regístralos con `imports`, `providers` y `exports` según las dependencias reales.
8. Usa Dependency Injection; no instancies manualmente.
9. Aplica la sección 4: transacciones donde se indica, `select: false` en columnas sensibles y respuestas siempre por DTO.
10. No crees repositories personalizados, carpetas vacías ni abstracciones sin justificación.
11. No duplicar entidades entre módulos ni configuración entre archivos.
12. No modifiques una migración ya ejecutada; los cambios de esquema van en una migración nueva.
13. Mantén coherencia entre módulos.
14. Agrega pruebas para las reglas de negocio que implementes (sección 9).

### 12.1 Antes de refactorizar: diagnóstico

- ¿Cómo se cargan hoy las variables de entorno? ¿Se carga `.env` correctamente?
- ¿Dónde se configura TypeORM? ¿Hay configuraciones duplicadas?
- ¿`env.ts` tiene valores escritos a mano?
- ¿`.env.example` refleja las variables reales?
- ¿Qué hace `data-source.ts`? ¿Comparte la configuración con la aplicación?
- ¿Qué módulos están registrados y qué imports y exports tienen?

### 12.2 Después del diagnóstico: cambios incrementales

No reescribas el backend de una sola vez. Orden de prioridad:

1. Carga y validación de variables de entorno.
2. Una única configuración coherente de PostgreSQL.
3. TypeORM y migraciones.
4. Estructura estándar de módulos.
5. Refactor progresivo de cada módulo.

Verifica que compile y funcione después de cada paso. Si un cambio implica modificar entidades o migraciones existentes, explica primero el impacto y evita cambios destructivos.

### 12.3 Al terminar cada tarea

Ejecuta `build`, `lint` y las pruebas pertinentes, y las migraciones sobre una base vacía si hubo cambios de esquema. Informa:

- Archivos creados y modificados.
- Decisiones tomadas y por qué.
- Comandos ejecutados y su resultado.
- Problemas encontrados y pendientes.

---

## 13. Principio arquitectónico y criterios de decisión

MatchRoom debe mantener una arquitectura modular, clara y pragmática. La prioridad no es aplicar DDD de forma estricta ni todos los patrones de diseño, sino un backend real, mantenible y escalable donde cada módulo tenga responsabilidades claras y las dependencias estén controladas.

**Regla principal:** organiza por funcionalidades del negocio, separa responsabilidades, usa Dependency Injection y evita complejidad que no aporte valor real.

### 13.1 Criterios de decisión

| Situación | Decisión |
|---|---|
| Nueva funcionalidad | Va en el módulo dueño de su entidad principal. Si toca dos módulos, orquesta el que inicia el caso de uso. |
| Necesito datos de otro módulo | Puntual: service exportado. Masivo o con joins: query service de solo lectura con `DataSource`. Nunca escribir en entidades ajenas. |
| Dos módulos se necesitan mutuamente | Evento para la dirección "hacia arriba"; si hace falta una transacción conjunta, el módulo superior llama al inferior. |
| ¿Repository personalizado? | Solo si la misma consulta compleja se usa en dos o más lugares. |
| Nueva tabla o columna | No sin actualizar antes el documento de entidades y crear la migración. |
| Nueva librería | Solo si Nest o TypeORM no la resuelven. Menciónala en el reporte final. |
| Optimización o caché (por ejemplo, de compatibilidad) | Primero mide con pruebas de rendimiento; no la agregues por anticipado. |

### 13.2 Definición de terminado

Un cambio está terminado cuando:

- Compila y pasa lint y pruebas.
- Las migraciones (si las hay) funcionan en `up` y `down` sobre una base vacía.
- Las respuestas usan DTOs y no exponen campos sensibles.
- La autorización por recurso está validada en el service.
- Los endpoints están documentados en Swagger.
- Se informaron los archivos modificados, las decisiones y los pendientes.
