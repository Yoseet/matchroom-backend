# MatchRoom — Entidades de base de datos (PostgreSQL)

**Versión:** 1.1 — MVP
**Fecha:** 4 de noviembre de 2026
**Fuente:** `matchroom_requerimientos_consolidados.md` v1.1.
**Alcance:** entidades necesarias para el MVP. Las optimizaciones de compatibilidad y las funciones de fases posteriores se documentan como extensiones, pero no se implementan como tablas en esta versión.

**Instrucción para el agente:** crea únicamente las entidades descritas en este documento mediante migraciones versionadas para NestJS y el ORM seleccionado. Respeta tipos, nulabilidad, defaults, restricciones, índices y reglas de integridad. No agregues tablas ni columnas sin actualizar primero este documento y justificar el cambio.

## Convenciones

- PostgreSQL 15 o superior. Extensión `citext` para correo sin distinción de mayúsculas. Las coordenadas usan el tipo nativo `point`; `postgis` es opcional. `gen_random_uuid()` está disponible de forma nativa en PostgreSQL.
- Nombres en `snake_case`, tablas en plural.
- PK `id uuid` con default `gen_random_uuid()`; la aplicación puede enviar UUID v7. Usar UUID v7 para entidades donde el orden temporal facilite paginación, especialmente mensajes. Tablas 1:1 con `users` usan `user_id` como PK. Tablas de unión usan PK compuesta.
- Fechas y horas: `timestamptz` almacenado en UTC. Fechas sin hora, como `birth_date` y `available_from`, usan `date`.
- `created_at` y `updated_at`: `timestamptz NOT NULL DEFAULT now()`. `updated_at` solo donde aparece. La aplicación/ORM debe actualizarlo al modificar la fila.
- Dinero: `numeric(12,2)`, nunca `float`; moneda predeterminada `MXN` (`char(3)`).
- Enums: columna `text` + `CHECK (col IN (...))`, sin tipos enum nativos.
- `ON DELETE`: `RESTRICT` por defecto. `[cascade]` o `[set null]` donde se indica.
- Nunca `synchronize: true`; todo por migraciones versionadas. Los `CHECK`, índices parciales y columnas geográficas se implementan mediante SQL en las migraciones si el ORM no los soporta directamente.

**Leyenda:** `NN` = NOT NULL · `UQ` = UNIQUE · `D=` = default · `in(a,b)` = CHECK IN · `FK -> tabla` = clave foránea · sin `NN` = admite NULL.

---

## 1. Catálogos

```
cities
  id              uuid PK
  name            text NN
  state_name      text NN
  country_code    char(2) NN D='MX'
  is_active       boolean NN D=true
  created_at

zones
  id              uuid PK
  city_id         uuid NN FK -> cities
  name            text NN
  slug            text NN
  is_active       boolean NN D=true
  UQ (city_id, slug)

amenities
  id              uuid PK
  code            text NN UQ
  name            text NN
  is_active       boolean NN D=true
```

## 2. Cuentas y acceso

```
users
  id                      uuid PK
  email                   citext NN UQ
  email_verified_at       timestamptz
  password_hash           text                      -- null si solo usa Google
  status                  text NN D='active'        in(active,pending_deletion,suspended,deleted)
  active_mode             text NN D='seeker'        in(seeker,landlord)
  landlord_enabled_at     timestamptz
  identity_status         text NN D='not_started'   in(not_started,in_progress,verified,rejected,manual_review)
  identity_verified_at    timestamptz
  failed_login_count      smallint NN D=0
  locked_until            timestamptz
  last_login_at           timestamptz
  deletion_requested_at   timestamptz
  deletion_scheduled_at   timestamptz
  created_at, updated_at

auth_identities
  id                  uuid PK
  user_id             uuid NN FK -> users [cascade]
  provider            text NN                       in(google)
  provider_user_id    text NN
  provider_email      citext
  created_at
  UQ (provider, provider_user_id)
  INDEX (user_id)

user_sessions
  id                  uuid PK
  user_id             uuid NN FK -> users [cascade]
  refresh_token_hash  text NN UQ
  user_agent          text
  ip_address          inet
  expires_at          timestamptz NN
  revoked_at          timestamptz
  last_used_at        timestamptz
  created_at
  INDEX (user_id) WHERE revoked_at IS NULL

one_time_tokens
  id                  uuid PK
  user_id             uuid NN FK -> users [cascade]
  purpose             text NN                       in(email_verification,password_reset)
  token_hash          text NN UQ
  expires_at          timestamptz NN
  used_at             timestamptz
  created_at
  INDEX (user_id, purpose)

legal_acceptances
  id                  uuid PK
  user_id             uuid NN FK -> users [cascade]
  document_type       text NN                       in(terms,privacy)
  document_version    text NN
  adult_declared      boolean NN
  ip_address          inet
  accepted_at         timestamptz NN D=now()
  UQ (user_id, document_type, document_version)
```

## 3. Archivos (metadatos)

```
media_assets
  id                  uuid PK
  owner_user_id       uuid NN FK -> users
  kind                text NN                       in(profile_photo,property_photo,chat_image,report_evidence)
  storage_key         text NN UQ
  mime_type           text NN                       in(image/jpeg,image/png,image/webp)
  size_bytes          integer NN                    CHECK (size_bytes BETWEEN 1 AND 5242880)
  width               integer
  height              integer
  moderation_status   text NN D='pending'           in(pending,approved,rejected)
  moderation_reason   text
  created_at
  deleted_at          timestamptz
```

## 4. Perfil y preferencias

El perfil se crea vacío junto con el usuario; los campos son opcionales en BD y la completitud se valida en el servicio.

```
profiles
  user_id             uuid PK FK -> users [cascade]
  first_name          text
  last_name           text
  birth_date          date
  gender              text
  bio                 text                          CHECK length <= 500
  occupation          text
  contact_phone       text
  photo_asset_id      uuid FK -> media_assets [set null]
  looking_for         text NN D='both'              in(roommate,housing,both)
  city_id             uuid FK -> cities
  completeness_pct    smallint NN D=0               CHECK (completeness_pct BETWEEN 0 AND 100)
  created_at, updated_at
  INDEX (city_id, completeness_pct)

lifestyle_profiles
  user_id             uuid PK FK -> users [cascade]
  cleanliness_level   smallint                      CHECK 1..5
  smokes              boolean
  has_pets            boolean
  noise_level         smallint                      CHECK 1..5
  visits_frequency    text                          in(never,rare,sometimes,often)
  sleep_schedule      text                          in(early,regular,late)
  work_schedule       text                          in(morning,afternoon,night,remote,flexible)
  cohabitation_type   text                          in(join_existing_home,find_place_together,any)
  updated_at

roommate_preferences
  user_id               uuid PK FK -> users [cascade]
  smoking_policy        text                        in(accept,reject,indifferent)
  pets_policy           text                        in(accept,reject,indifferent)
  max_noise_level       smallint                    CHECK 1..5
  max_visits_frequency  text                        in(never,rare,sometimes,often)
  min_cleanliness_level smallint                    CHECK 1..5
  min_age               smallint
  max_age               smallint
  exclusive_criteria    text[] NN D='{}'            -- valores: smoking,pets,noise,visits,cleanliness,age
  updated_at
  CHECK (min_age IS NULL OR max_age IS NULL OR min_age <= max_age)
  CHECK (exclusive_criteria <@ ARRAY['smoking','pets','noise','visits','cleanliness','age']::text[])

housing_preferences
  user_id               uuid PK FK -> users [cascade]
  property_type         text                        in(room,apartment,any)
  budget_min            numeric(12,2)               CHECK >= 0
  budget_max            numeric(12,2)               CHECK >= 0
  move_in_date          date
  requires_furnished    boolean                     -- null = indiferente
  requires_pets_allowed boolean
  updated_at
  CHECK (budget_min <= budget_max)

user_preferred_zones
  user_id             uuid FK -> users [cascade]
  zone_id             uuid FK -> zones
  PK (user_id, zone_id)
  INDEX (zone_id, user_id)

housing_preference_amenities
  user_id             uuid FK -> users [cascade]
  amenity_id          uuid FK -> amenities
  PK (user_id, amenity_id)
```

## 5. Privacidad y verificación

```
privacy_settings
  user_id                   uuid PK FK -> users [cascade]
  profile_visibility        text NN D='everyone'    in(everyone,verified_only,matches_only)
  show_exact_age            boolean NN D=true
  show_occupation           boolean NN D=true
  show_photo                boolean NN D=true
  appear_in_search          boolean NN D=true
  show_housing_preferences  boolean NN D=true
  show_property_interest    boolean NN D=false
  updated_at

privacy_requests
  id                  uuid PK
  user_id             uuid NN FK -> users
  request_type        text NN                       in(access,rectification,cancellation,opposition)
  status              text NN D='pending'           in(pending,in_progress,completed,rejected)
  details             text
  created_at
  resolved_at         timestamptz

identity_verifications
  id                  uuid PK
  user_id             uuid NN FK -> users [cascade]
  provider            text NN
  provider_reference  text
  status              text NN                       in(in_progress,verified,rejected,manual_review)
  attempt_number      smallint NN
  rejection_code      text
  started_at          timestamptz NN D=now()
  completed_at        timestamptz
  created_at
  UQ (user_id, attempt_number)
  UQ (user_id) WHERE status = 'in_progress'
```

## 6. Propiedades

```
properties
  id                         uuid PK
  landlord_id                uuid NN FK -> users
  title                      text                      CHECK length <= 120
  description                text
  property_type              text                      in(room,apartment)
  city_id                    uuid FK -> cities
  zone_id                    uuid FK -> zones
  address_exact              text                      -- privada
  location_exact             point                     -- privada, (lng,lat)
  location_public            point                     -- aproximada (~300 m)
  rent_amount                numeric(12,2)             CHECK > 0
  deposit_amount             numeric(12,2)             CHECK >= 0
  additional_costs_estimate  numeric(12,2)             CHECK >= 0
  currency                   char(3) NN D='MXN'
  available_from             date
  bedrooms                   smallint                  CHECK >= 0
  bathrooms                  smallint                  CHECK >= 0
  furnished                  boolean NN D=false
  pets_allowed               boolean NN D=false
  smokers_allowed            boolean NN D=false
  house_rules                text
  requires_guarantor         boolean NN D=false
  requires_income_proof      boolean NN D=false
  min_contract_months        smallint                  CHECK >= 0
  status                     text NN D='draft'         in(draft,in_review,active,reserved,rented,paused,rejected,deleted,expired)
  rejection_reason           text
  reviewed_at                timestamptz
  published_at               timestamptz
  expires_at                 timestamptz
  created_at, updated_at
  deleted_at                 timestamptz
  CHECK (status IN ('draft','deleted') OR (title IS NOT NULL AND property_type IS NOT NULL
         AND city_id IS NOT NULL AND zone_id IS NOT NULL AND rent_amount IS NOT NULL
         AND available_from IS NOT NULL AND location_public IS NOT NULL))
  INDEX (city_id, zone_id, rent_amount) WHERE status = 'active' AND deleted_at IS NULL
  INDEX GIST (location_public)
  INDEX (landlord_id, status)

property_photos
  id                  uuid PK
  property_id         uuid NN FK -> properties [cascade]
  asset_id            uuid NN UQ FK -> media_assets
  position            smallint NN                   CHECK 1..15
  is_cover            boolean NN D=false
  created_at
  UQ (property_id, position)
  UQ (property_id) WHERE is_cover

property_amenities
  property_id         uuid FK -> properties [cascade]
  amenity_id          uuid FK -> amenities
  PK (property_id, amenity_id)

property_status_history
  id                  uuid PK
  property_id         uuid NN FK -> properties [cascade]
  changed_by          uuid FK -> users [set null]   -- null si lo cambia el sistema
  from_status         text
  to_status           text NN
  reason              text
  created_at
  INDEX (property_id, created_at)

favorite_properties
  user_id             uuid FK -> users [cascade]
  property_id         uuid FK -> properties [cascade]
  created_at
  PK (user_id, property_id)
```

## 7. Interés, match y compatibilidad

```
user_interests
  id                  uuid PK
  from_user_id        uuid NN FK -> users [cascade]
  to_user_id          uuid NN FK -> users [cascade]
  action              text NN                       in(interested,dismissed)
  created_at, updated_at
  UQ (from_user_id, to_user_id)
  CHECK (from_user_id <> to_user_id)
  INDEX (to_user_id, action)
  INDEX (from_user_id, created_at) WHERE action = 'interested'

matches
  id                  uuid PK
  user_a_id           uuid NN FK -> users [cascade]
  user_b_id           uuid NN FK -> users [cascade]
  status              text NN D='active'            in(active,unmatched)
  unmatched_by        uuid FK -> users [set null]
  matched_at          timestamptz NN D=now()
  unmatched_at        timestamptz
  CHECK (user_a_id < user_b_id)
  UQ (user_a_id, user_b_id)
  INDEX (user_a_id), INDEX (user_b_id)
```

### Implementación de compatibilidad en el MVP

La compatibilidad no se almacena en tablas propias durante el MVP. Se calcula en `CompatibilityService` a partir de los perfiles, hábitos, preferencias y datos de la propiedad vigentes.

- Los pesos iniciales y la fórmula de `RN-COM-02` viven como configuración versionada en el backend, no como registros administrables en PostgreSQL.
- El servicio devuelve el porcentaje, el desglose por categoría y las coincidencias/diferencias que explican la recomendación.
- Antes de calcular, se aplican los filtros de elegibilidad, privacidad, bloqueos y preferencias excluyentes.
- Para ordenar por compatibilidad, primero se aplican en PostgreSQL los filtros que reducen el conjunto de candidatos (ciudad, zonas, rango de edad y criterios excluyentes); después se calcula la puntuación y se pagina el resultado ordenado. No se debe puntuar solamente una página ya paginada ni cargar indiscriminadamente todos los usuarios en memoria.
- La implementación inicial puede usar una consulta SQL/CTE o un conjunto acotado de candidatos procesado por el servicio. La alternativa se decide con pruebas de rendimiento sobre el volumen esperado.
- Si las pruebas muestran que el cálculo en tiempo de consulta no cumple los RNF, se podrá añadir una caché de puntuaciones en una migración posterior. Esa caché deberá tener una estrategia explícita de invalidación; no forma parte del esquema inicial.

Esta decisión evita mantener tablas de puntuaciones direccionales y procesos de invalidación antes de conocer el volumen real de consultas, sin limitar la evolución del módulo.

## 8. Chat

```
conversations
  id                  uuid PK
  kind                text NN                       in(roommate,rental)
  match_id            uuid FK -> matches
  property_id         uuid FK -> properties
  initiator_user_id   uuid FK -> users
  status              text NN D='active'            in(active,closed)
  closed_reason       text                          in(unmatched,blocked,account_deleted)
  last_message_at     timestamptz
  created_at
  CHECK (
    (kind='roommate' AND match_id IS NOT NULL AND property_id IS NULL AND initiator_user_id IS NULL)
    OR
    (kind='rental' AND property_id IS NOT NULL AND match_id IS NULL AND initiator_user_id IS NOT NULL)
  )
  UQ (match_id) WHERE kind = 'roommate'
  UQ (property_id, initiator_user_id) WHERE kind = 'rental'
  INDEX (last_message_at DESC)

conversation_participants
  conversation_id     uuid FK -> conversations [cascade]
  user_id             uuid FK -> users
  last_read_at        timestamptz
  joined_at           timestamptz NN D=now()
  PK (conversation_id, user_id)
  INDEX (user_id, conversation_id)

messages
  id                  uuid PK                       -- uuid v7 (ordenable)
  conversation_id     uuid NN FK -> conversations [cascade]
  sender_id           uuid NN FK -> users
  client_message_id   uuid NN
  body                text
  media_asset_id      uuid FK -> media_assets
  delivered_at        timestamptz
  read_at             timestamptz
  created_at
  CHECK ((body IS NOT NULL AND length(trim(body)) > 0) OR media_asset_id IS NOT NULL)
  UQ (conversation_id, sender_id, client_message_id)
  INDEX (conversation_id, id)
```

## 9. Seguridad

```
user_blocks
  blocker_id          uuid FK -> users [cascade]
  blocked_id          uuid FK -> users [cascade]
  created_at
  PK (blocker_id, blocked_id)
  CHECK (blocker_id <> blocked_id)
  INDEX (blocked_id)

reports
  id                    uuid PK
  reporter_id           uuid NN FK -> users
  target_type           text NN                     in(user,property,message)
  target_user_id        uuid FK -> users
  target_property_id    uuid FK -> properties
  target_message_id     uuid FK -> messages
  reason                text NN                     in(fraud,duplicate,false_info,inappropriate_content,harassment,other)
  comment               text
  evidence_asset_id     uuid FK -> media_assets
  status                text NN D='open'            in(open,in_review,resolved,dismissed)
  created_at
  resolved_at           timestamptz
  CHECK (num_nonnulls(target_user_id, target_property_id, target_message_id) = 1
         AND ((target_type='user' AND target_user_id IS NOT NULL)
           OR (target_type='property' AND target_property_id IS NOT NULL)
           OR (target_type='message' AND target_message_id IS NOT NULL)))
  INDEX (status, created_at)
  INDEX (target_user_id), INDEX (target_property_id), INDEX (target_message_id)
```

## 10. Notificaciones y auditoría

```
notifications
  id                  uuid PK
  user_id             uuid NN FK -> users [cascade]
  kind                text NN                       in(new_match,new_message,property_status,property_expiring,identity_result)
  data                jsonb NN D='{}'
  read_at             timestamptz
  created_at
  INDEX (user_id, created_at DESC)
  INDEX (user_id) WHERE read_at IS NULL

notification_preferences
  user_id             uuid FK -> users [cascade]
  notification_kind   text                          in(new_match,new_message,property_status,property_expiring,identity_result)
  channel             text                          in(in_app,push,email)
  enabled             boolean NN D=true
  PK (user_id, notification_kind, channel)

push_devices
  id                  uuid PK
  user_id             uuid NN FK -> users [cascade]
  platform            text NN                       in(ios,android)
  token               text NN UQ
  last_seen_at        timestamptz
  revoked_at          timestamptz
  created_at

audit_logs                                          -- solo inserciones
  id                  uuid PK
  actor_user_id       uuid FK -> users [set null]
  action              text NN
  entity_type         text
  entity_id           uuid
  metadata            jsonb NN D='{}'
  ip_address          inet
  created_at
  INDEX (entity_type, entity_id)
  INDEX (actor_user_id, created_at)
```

---

## Orden de creación

1. Extensiones.
2. Catálogos (1).
3. Cuentas y acceso (2).
4. Archivos (3).
5. Perfil y preferencias (4).
6. Privacidad y verificación (5).
7. Propiedades (6).
8. Interés y match (7); la compatibilidad se implementa en el servicio y no crea tablas adicionales.
9. Chat (8).
10. Seguridad (9).
11. Notificaciones y auditoría (10).

## Datos semilla

- `cities` y `zones` de la ciudad de lanzamiento.
- `amenities`: agua, luz, gas, internet, lavadora, estacionamiento, etc.


---

## Reglas transversales de integridad y comportamiento

Estas reglas se implementan principalmente en los servicios de NestJS y en transacciones. Las restricciones SQL protegen la integridad básica, pero no sustituyen la autorización por recurso.

### 1. Registro y autenticación

- `users`, `profiles` y `privacy_settings` se crean en una sola transacción durante el registro. `profiles` se crea vacío; `lifestyle_profiles`, `roommate_preferences` y `housing_preferences` se crean cuando el usuario comienza a completar esos apartados.
- La aceptación de términos y privacidad se registra en `legal_acceptances`, incluyendo la versión del documento y la declaración de mayoría de edad. La edad se valida en el servicio a partir de `profiles.birth_date`.
- `one_time_tokens` almacena únicamente hashes. Un token es válido si no se ha usado y `expires_at > now()`; el consumo del token debe ser atómico.
- `user_sessions` almacena hashes de refresh tokens, nunca tokens en texto plano. Cerrar todas las sesiones revoca las sesiones activas del usuario.
- Si el correo de Google coincide con una cuenta existente, la vinculación requiere la confirmación indicada por `RN-USR-02`; no se deben fusionar cuentas automáticamente solo por coincidencia de correo.

### 2. Visibilidad y privacidad de perfiles

Un perfil puede aparecer en búsquedas o recomendaciones únicamente cuando se cumplan todas las condiciones siguientes:

- La cuenta está activa y el correo está verificado.
- `profiles.completeness_pct >= 70`.
- `privacy_settings.appear_in_search = true` y la configuración de visibilidad permite mostrarlo al usuario que consulta.
- No existe un bloqueo en ninguna dirección entre ambos usuarios.
- No existe un descarte vigente (`user_interests.action = 'dismissed'`) realizado por el usuario que consulta.
- El perfil candidato cumple las preferencias excluyentes del usuario que consulta.

La consulta que construye el conjunto de perfiles descubribles debe centralizarse en un servicio/query builder reutilizable para evitar que los endpoints apliquen reglas diferentes.

### 3. Verificación y acciones restringidas

- Explorar perfiles y propiedades no exige verificación de identidad.
- Enviar intereses, crear conversaciones de renta, enviar mensajes, activar el modo arrendador y publicar anuncios exige que la identidad del usuario esté verificada y que la cuenta esté activa.
- La verificación de correo y la verificación de identidad son estados independientes.
- `users.identity_status` e `identity_verified_at` representan el estado vigente para consultas rápidas. `VerificationService` es el único responsable de actualizarlos en la misma transacción que actualiza `identity_verifications`.
- Los accesos a referencias o resultados sensibles de verificación se registran en `audit_logs`. No se almacenan imágenes de documentos oficiales ni secretos del proveedor.

### 4. Intereses y matches

- `user_interests` mantiene una fila única por pareja direccional. `interested` representa interés positivo; `dismissed` registra el descarte requerido por RF-ROO-05/06. Revertir un descarte elimina o actualiza esa fila desde el servicio.
- El límite diario de intereses se aplica únicamente a acciones `interested`, no a descartes.
- Al enviar interés, el servicio comprueba el interés inverso. Si ambos usuarios están interesados, crea un único `matches` con los IDs normalizados (`user_a_id < user_b_id`).
- La creación del interés, match, conversación de roomies, sus dos participantes y las notificaciones se coordina en una transacción. Las restricciones únicas y `ON CONFLICT` protegen contra solicitudes concurrentes o reintentos.
- No se permite crear un match si existe un bloqueo en cualquiera de las dos direcciones.

### 5. Conversaciones y mensajes

- Se conserva `conversation_participants` aunque las conversaciones del MVP sean individuales. Esta tabla permite validar pertenencia, guardar `last_read_at` por usuario y calcular mensajes no leídos sin duplicar columnas en `conversations`.
- Cada conversación debe tener exactamente dos participantes. En una conversación `roommate`, deben ser los dos usuarios del match; en una conversación `rental`, deben ser el usuario que inició el contacto y el arrendador de la propiedad. El servicio crea esos registros en la misma transacción que la conversación.
- `conversations` debe cumplir la condición de tipo: `roommate` usa `match_id`; `rental` usa `property_id` e `initiator_user_id`. Nunca se combinan ambos modelos.
- Solo un participante puede consultar o enviar mensajes en una conversación. El remitente debe pertenecer a `conversation_participants`, la conversación debe estar activa y no debe existir un bloqueo en ninguna dirección.
- `client_message_id` hace idempotente el envío ante reintentos del cliente móvil. El envío del mensaje y la actualización de `last_message_at` ocurren en una transacción.
- Las conversaciones se consultan por `last_message_at DESC`; los mensajes se paginan por cursor usando su ID. `last_read_at` se actualiza para el participante que leyó.
- El arrendador no puede iniciar una conversación `rental`; solo puede responder cuando el interesado la creó desde el anuncio.

### 6. Propiedades y ubicación

- El servicio valida que `zone_id` pertenezca a `city_id`, y que el propietario sea una cuenta activa con identidad verificada y modo arrendador habilitado.
- Los cambios de estado siguen las transiciones válidas de la tabla `properties.status`. Cada cambio inserta su registro en `property_status_history` dentro de la misma transacción.
- Solo propiedades con `status = 'active'` aparecen en resultados predeterminados.
- `address_exact` y `location_exact` nunca se devuelven en listados, tarjetas ni mapas. La ubicación pública se calcula al guardar el anuncio y se aproxima con el desplazamiento definido por el producto.
- La dirección exacta solo se devuelve al arrendador propietario o al usuario que inició una conversación `rental` válida para esa propiedad.
- El máximo de 15 fotografías se protege con `position BETWEEN 1 AND 15` y `UNIQUE (property_id, position)`. El servicio valida que exista una portada antes de publicar el anuncio.
- El RF-ARR-09 exige revisión de anuncios de cuentas nuevas. Como el panel de administración no forma parte del alcance, antes del lanzamiento debe definirse quién ejecuta esa revisión y mediante qué proceso operativo. `in_review`, `reviewed_at` y `rejection_reason` almacenan el estado y resultado; no sustituyen el proceso de revisión.

### 7. Archivos y moderación

- Los binarios se almacenan fuera de PostgreSQL; `media_assets.storage_key` contiene la referencia al objeto almacenado.
- El servicio valida propietario, formato MIME real y tamaño antes de aceptar un archivo. La moderación automática actualiza `moderation_status`; solo los archivos aprobados pueden mostrarse en superficies públicas.
- El usuario que adjunta una imagen debe ser el propietario del `media_asset` o tener autorización explícita para usarlo. Esta validación se realiza en el servicio.

### 8. Bloqueos, reportes y solicitudes de privacidad

- Todas las búsquedas, recomendaciones, intereses y operaciones de chat excluyen bloqueos en ambas direcciones.
- `reports` apunta exactamente a un objetivo (`user`, `property` o `message`). Un reporte se registra como señal y no como infracción confirmada.
- El MVP registra reportes, pero debe existir un procedimiento operativo para revisarlos y atender riesgos urgentes aunque no haya panel administrativo.
- `privacy_requests` registra solicitudes relacionadas con derechos ARCO. El acceso, conservación y resolución se gestionan conforme al aviso de privacidad y a la política legal del producto.

### 9. Notificaciones y auditoría

- Toda notificación consultable se inserta primero en `notifications`; push o correo son canales de entrega y no sustituyen el historial dentro de la aplicación.
- Las preferencias se consultan por tipo y canal. Si no existe una fila para una combinación, se aplica el valor predeterminado definido por el producto.
- `push_devices` registra tokens por dispositivo. Como `token` es único, si se registra con otra cuenta se reasigna la fila existente de forma transaccional y se actualiza su propietario; no se inserta una segunda fila con el mismo token.
- `audit_logs` es de solo inserción y se limita a accesos a datos de identidad y acciones críticas. Nunca almacena contraseñas, tokens, documentos oficiales ni datos personales innecesarios.

### 10. Eliminación de cuenta

- Al solicitar la eliminación, la cuenta pasa a `pending_deletion`, se registran `deletion_requested_at` y `deletion_scheduled_at` (30 días después) y se revocan las sesiones.
- Las propiedades activas o en revisión se pausan, los matches se deshacen y las conversaciones se cierran con `account_deleted` para impedir nuevos mensajes.
- Al terminar el periodo de gracia, un proceso programado anonimiza o elimina los datos conforme a la política de conservación y obligaciones legales, y actualiza la cuenta a `deleted`.
- La eliminación lógica no debe borrar automáticamente mensajes, reportes o registros legales que deban conservarse. La política de conservación debe definir qué datos se anonimizan, cuáles se eliminan y cuáles se retienen.

### 11. Compatibilidad

- `CompatibilityService` aplica la fórmula ponderada de `RN-COM-02`, el traslape de presupuestos de `RN-COM-01` y las preferencias excluyentes de `RN-COM-03`.
- El cálculo considera las preferencias del usuario que consulta; por ello, la compatibilidad entre A y B puede diferir de la compatibilidad entre B y A.
- La fórmula debe devolver score, desglose y razones de coincidencia/diferencia sin almacenar estos resultados en tablas durante el MVP.
- Si el rendimiento medido no cumple los RNF, se diseña una caché en una fase posterior con invalidación explícita ante cambios de perfil, preferencias o propiedades.

---

## Decisiones técnicas que deben permanecer explícitas

1. Proveedor de verificación de identidad, límites de reintento y tratamiento de sus referencias.
2. Campos obligatorios y fórmula exacta de completitud del perfil.
3. Pesos y reglas de similitud iniciales para roomies y propiedades.
4. Límite diario de intereses y reglas anti-spam.
5. Política de conservación, anonimización y eliminación de datos al concluir los 30 días.
6. Proceso operativo para revisar anuncios nuevos y atender reportes sin panel administrativo.
7. Semántica para reactivar un match después de que una de las partes lo deshizo, si el producto permite volver a conectar.
8. Métricas y pruebas para determinar si el cálculo de compatibilidad en tiempo de consulta requiere caché.
