# Lista preliminar de funcionalidades por módulo (MatchRoom)

Nov 5, 2026 · @Yoset Bello Perez

Lista de lo que se construirá en cada módulo del backend, con las entidades en que se apoya y una forma aproximada de hacerlo. Los números entre paréntesis remiten a los requerimientos consolidados. Es un punto de partida: se afina al definir el proyecto.

**Supuestos de stack:** NestJS con un módulo por dominio (controller, service, repositorio y DTOs validados con `class-validator`), PostgreSQL con PostGIS, almacenamiento de objetos compatible con S3, WebSocket para el chat y una cola (BullMQ con Redis) para tareas asíncronas.

**Módulo adicional:** la compatibilidad (requerimientos 9) no tiene tablas en tu esquema, pero necesita su propio módulo de servicio. Va como módulo 8.

## Piezas compartidas (se construyen primero)

| Pieza | Para qué sirve | Usada por |
| --- | --- | --- |
| `AuthGuard` y `ActiveUserGuard` | Exigen sesión válida y cuenta activa | Todos |
| `VerifiedIdentityGuard` | Bloquea acciones a usuarios sin identidad verificada (11.4) | matching, chat, properties |
| `BlockedFilter` | Excluye bloqueos en ambas direcciones en cualquier consulta | matching, properties, chat, compatibilidad |
| `DiscoverableUsersQuery` | Una sola consulta con las reglas de quién puede aparecer ante otro usuario | matching, compatibilidad |
| `PrivacyPolicyService` | Aplica la privacidad al devolver perfiles (edad, ocupación, foto) | profiles, matching |
| Eventos de dominio | Desacoplan módulos (match creado, perfil editado, usuario bloqueado) | Todos |
| Ayudante de transacciones | Agrupa varias escrituras en una sola transacción | accounts, matching, chat, properties |

## 1. catalog

Entidades: `cities`, `zones`, `amenities`.

| Funcionalidad | Entidades | Cómo construirla |
| --- | --- | --- |
| Listar ciudades activas (5.1, 2.3) | `cities` | `GET /cities`; filtra `is_active`. Puede cachearse en memoria porque casi no cambia. |
| Listar y buscar zonas de una ciudad, con autocompletado (5.1) | `zones` | `GET /cities/:id/zones?q=`; búsqueda con `ILIKE` sobre `name`. |
| Listar servicios (amenities) (2.5, 4.1, 5.2) | `amenities` | `GET /amenities`. |
| Validar que una zona pertenezca a su ciudad | `zones` | Método reutilizable `assertZoneInCity()` en el servicio, usado por perfiles y propiedades. |
| Cargar datos iniciales | las tres | Seeds de la ciudad de lanzamiento. Sin CRUD de administración en el MVP. |

## 2. accounts

Entidades: `users`, `auth_identities`, `user_sessions`, `one_time_tokens`, `legal_acceptances`.

| Funcionalidad | Entidades | Cómo construirla |
| --- | --- | --- |
| Registro con correo y contraseña (1.1) | `users`, `legal_acceptances`, y crea `profiles` y `privacy_settings` | DTO que valida 8+ caracteres con letras y números; hash con argon2 o bcrypt; todo en una transacción, incluida la aceptación de términos y mayoría de edad (6.2). |
| Verificación de correo, con reenvío (1.4) | `one_time_tokens`, `users.email_verified_at` | Token aleatorio, solo se guarda su hash; vence en 24 h. Consumo atómico con `UPDATE ... WHERE used_at IS NULL AND expires_at > now() RETURNING`. |
| Inicio de sesión y renovación de tokens (1.2) | `user_sessions`, `users` | JWT de acceso corto y refresh token con hash en `user_sessions`, con rotación en cada uso. |
| Cierre de sesión actual o en todos los dispositivos (1.2) | `user_sessions` | Marcar `revoked_at` en una sesión o en todas las del usuario. |
| Bloqueo por intentos fallidos (1.5) | `users.failed_login_count`, `locked_until` | Incrementar en cada fallo, bloquear tras 5 y reiniciar al acertar. |
| Recuperar contraseña (1.3) | `one_time_tokens` | Enlace de un solo uso que vence en 1 h; al cambiarla se revocan las sesiones. Respuesta genérica para no revelar si el correo existe. |
| Cambiar contraseña desde ajustes (1.3) | `users` | Exige la contraseña actual. |
| Registro e inicio con Google (1.6) | `auth_identities` | Validar el `id_token` con `google-auth-library`. Si el correo ya existe, pedir confirmación antes de vincular. |
| Cambiar entre modo buscador y arrendador (2.7) | `users.active_mode` | `PATCH /me/mode`; no cierra sesión. |
| Activar modo arrendador (4.7) | `users.landlord_enabled_at` | Exige identidad verificada. |
| Eliminar cuenta con 30 días de gracia (3.2) | `users`, `user_sessions` | Confirmar contraseña, pasar a `pending_deletion` y revocar sesiones. Un evento pausa propiedades, deshace matches y cierra chats. Un job programado hace la anonimización final. |

## 3. media

Entidades: `media_assets`.

| Funcionalidad | Entidades | Cómo construirla |
| --- | --- | --- |
| Subir imágenes de perfil, anuncio, chat y evidencia (2.1, 4.3, 10.4, 6.4) | `media_assets` | Subida directa con URL prefirmada o multipart. Validar tipo MIME real (por ejemplo con `file-type`) y máximo de 5 MB; guardar con `moderation_status = pending`. |
| Moderación automática (6.5) | `media_assets` | Tarea en cola que llama a un servicio de moderación y actualiza `moderation_status`. Solo las `approved` se muestran en superficies públicas. |
| Validar propiedad del archivo | `media_assets.owner_user_id` | Método `assertOwnedBy()` antes de usar una imagen en perfil, anuncio o mensaje. |
| Entregar imágenes | `media_assets` | URLs firmadas con caducidad. |
| Borrado lógico y limpieza | `media_assets.deleted_at` | Marcar y limpiar el objeto después, con un job. |

## 4. profiles

Entidades: `profiles`, `lifestyle_profiles`, `roommate_preferences`, `housing_preferences`, `user_preferred_zones`, `housing_preference_amenities`.

| Funcionalidad | Entidades | Cómo construirla |
| --- | --- | --- |
| Ver y editar datos básicos y foto (2.1) | `profiles`, `media_assets` | `GET/PATCH /me/profile`; la foto llega como `photo_asset_id`. |
| Elegir qué busca: roomie, vivienda o ambos (2.2) | `profiles.looking_for` | Campo del mismo endpoint; la app lo usa para ordenar la pantalla principal. |
| Perfil de convivencia: hábitos (2.3) | `lifestyle_profiles` | `PUT /me/lifestyle` con upsert por `user_id`. |
| Preferencias de roomie, con excluyentes (2.4) | `roommate_preferences` | `PUT /me/roommate-preferences`; validar `exclusive_criteria` contra los valores permitidos. |
| Preferencias de vivienda (2.5) | `housing_preferences`, `user_preferred_zones`, `housing_preference_amenities` | `PUT /me/housing-preferences`; zonas y servicios se reemplazan como conjunto dentro de una transacción. |
| Porcentaje de completitud (2.6) | `profiles.completeness_pct` | `ProfileCompletenessService` recalcula y guarda el valor después de cada cambio. Hay que definir los campos obligatorios. |
| Ver el perfil de otro usuario (7.3) | `profiles`, `lifestyle_profiles`, `housing_preferences`, `privacy_settings` | `GET /users/:id/profile`; un serializador pasa por `PrivacyPolicyService` para ocultar o generalizar edad, ocupación y foto. |
| Notificar cambios de perfil (9.5) | las anteriores | Evento `profile.updated`; útil si se agrega caché de compatibilidad después. |

## 5. privacy

Entidades: `privacy_settings`, `privacy_requests`, `identity_verifications`.

| Funcionalidad | Entidades | Cómo construirla |
| --- | --- | --- |
| Configurar privacidad (3.1) | `privacy_settings` | `GET/PATCH /me/privacy`: visibilidad del perfil, edad exacta, ocupación, foto, búsquedas y preferencias de vivienda. |
| Aplicar la privacidad en las respuestas (3.1) | `privacy_settings` | `PrivacyPolicyService`, que usan profiles y matching. |
| Solicitudes de derechos ARCO (6.2) | `privacy_requests` | `POST /privacy-requests` y listado propio; la resolución es manual en el MVP. |
| Aviso de privacidad (6.2) | `legal_acceptances` | Endpoint que devuelve el documento vigente y su versión. |
| Iniciar verificación de identidad (11.6) | `identity_verifications`, `users.identity_status` | Interfaz `IdentityProvider` con adaptador por proveedor, empezando con una implementación simulada. Crear el intento y marcar `in_progress`. |
| Recibir el resultado del proveedor (11.2, 11.6) | `identity_verifications`, `users` | Webhook que actualiza el intento y `identity_status` en la misma transacción. No se guardan imágenes del documento. |
| Consultar estado y reintentar (11.2, 11.5) | `identity_verifications` | `GET /me/identity`; límite de intentos por `attempt_number`. |
| Insignia de verificado (11.3) | `users.identity_status` | Bandera `identity_verified` en los DTOs de perfil, tarjeta, chat y anuncio. |
| Aviso de alcance (11.1) | — | Texto fijo en la app antes de verificar. |
| Auditar accesos sensibles | `audit_logs` | Registrar cada lectura de datos de verificación con `AuditService`. |

## 6. properties

Entidades: `properties`, `property_photos`, `property_amenities`, `property_status_history`, `favorite_properties`.

**Arrendador**

| Funcionalidad | Entidades | Cómo construirla |
| --- | --- | --- |
| Crear y guardar borrador (4.1, 4.2) | `properties`, `property_amenities` | `POST /properties` con validación relajada en borrador; usa `assertZoneInCity()`. |
| Calcular ubicación pública (5.4) | `properties.location_exact`, `location_public` | Al guardar, desplazar el punto con PostGIS usando un desplazamiento determinista de unos 300 m. |
| Requisitos de renta (4.4) | `properties` | Campos de aval, comprobante de ingresos y contrato mínimo. |
| Gestionar fotos: hasta 15, orden y portada (4.3) | `property_photos`, `media_assets` | Endpoints para agregar, reordenar y elegir portada; la base ya limita posición y portada única. |
| Enviar a revisión y publicar (4.8) | `properties`, `property_status_history` | Máquina de estados en código con `SELECT ... FOR UPDATE`; valida datos mínimos y portada. |
| Revisar anuncios nuevos (4.8) | `properties.reviewed_at`, `rejection_reason` | Sin panel, usar endpoints internos protegidos o un script para aprobar o rechazar. Falta definir quién lo hace. |
| Editar, pausar, reactivar y eliminar (4.2) | `properties`, `property_status_history` | Cada cambio de estado valida la transición y escribe el historial. |
| Cambiar a disponible, reservada o rentada (4.5) | `properties.status` | Mismo mecanismo de transiciones. |
| Ver mis anuncios | `properties` | `GET /me/properties` filtrable por estado. |
| Ver interesados (4.6) | `conversations` (tipo `rental`) | Listar los usuarios que contactaron por cada propiedad. |
| Expiración de anuncios | `properties.expires_at` | Job programado que pasa a `expired` y avisa antes de vencer. |

**Buscador**

| Funcionalidad | Entidades | Cómo construirla |
| --- | --- | --- |
| Buscar por ciudad, zona y filtros (5.1, 5.2) | `properties`, `property_amenities` | Query builder sobre propiedades `active`; aprovecha el índice parcial; paginación por cursor. |
| Ordenar por precio o fecha (5.3) | `properties` | Orden en SQL; por compatibilidad lo delega al módulo de compatibilidad. |
| Vista de mapa (5.6) | `properties.location_public` | Consulta por rectángulo visible (`ST_MakeEnvelope`) con el índice GIST; solo devuelve ubicación pública. |
| Detalle del anuncio (5.4) | `properties`, `property_photos` | Devuelve `address_exact` solo al dueño o a quien inició un chat de renta válido. |
| Favoritos (5.5) | `favorite_properties` | `PUT/DELETE /properties/:id/favorite` y listado. |

## 7. matching

Entidades: `user_interests`, `matches`.

| Funcionalidad | Entidades | Cómo construirla |
| --- | --- | --- |
| Descubrir roomies con filtros (7.1, 7.2) | `profiles`, `lifestyle_profiles`, `user_interests` | Usa `DiscoverableUsersQuery`; filtra en SQL y delega el orden por compatibilidad. |
| Me interesa y descartar (7.4) | `user_interests` | `PUT /users/:id/interest` con upsert; exige identidad verificada. |
| Límite diario de intereses (7.4) | `user_interests` | Contar los `interested` del día dentro de la misma transacción; el límite es configuración. |
| Revertir descartes (7.5) | `user_interests` | Listar los `dismissed` y eliminar la fila. |
| Crear match por interés mutuo (7.6) | `user_interests`, `matches`, `conversations`, `conversation_participants` | En una transacción: revisar interés inverso, insertar el match con IDs normalizados y `ON CONFLICT DO NOTHING`, crear el chat y avisar a ambos. Rechazar si hay bloqueo. |
| Mis matches (7.7) | `matches` | `GET /me/matches`. |
| Deshacer match (7.7) | `matches`, `conversations` | Marcar `unmatched`, registrar quién lo hizo y cerrar el chat con `unmatched`. |

## 8. compatibilidad (servicio sin tablas)

| Funcionalidad | Entidades que lee | Cómo construirla |
| --- | --- | --- |
| Configuración de pesos (9.1) | — | Archivo de configuración versionado en el backend, no en la base de datos. |
| Compatibilidad entre usuarios (9.1) | `lifestyle_profiles`, `roommate_preferences`, `housing_preferences`, `user_preferred_zones` | Funciones puras de similitud por criterio y suma ponderada; el presupuesto puntea por traslape de rangos. Con pruebas unitarias. |
| Compatibilidad entre usuario y propiedad (9.2) | `housing_preferences`, `properties`, `property_amenities` | Misma lógica con presupuesto, zona, tipo, servicios, mascotas, mobiliario y fecha. |
| Desglose y razones (9.3) | las anteriores | El servicio devuelve puntaje por categoría y coincidencias y diferencias. |
| Excluir a quien incumple excluyentes (9.4) | `roommate_preferences` | Filtro en SQL dentro de `DiscoverableUsersQuery`, antes de calcular. |
| Orden por compatibilidad con paginación | las anteriores | Reducir candidatos en SQL, calcular, ordenar y paginar al final. Nunca puntuar solo una página. |
| Recalcular al cambiar datos (9.5) | — | Al calcular al vuelo no hay nada que invalidar. Si luego se agrega caché, se engancha a los eventos de perfil y propiedad. |
| Roomies para quien busca vivienda y roomies interesados en una propiedad (9.6) | `favorite_properties`, `conversations`, `privacy_settings` | Candidatos que buscan en la misma zona o guardaron la propiedad, respetando `show_property_interest`. |
| Propiedades para quien busca roomie (9.7) | `properties`, `housing_preferences` | Propiedades con presupuesto y zonas en común con ambos. |
| Sección Para ti con el motivo (9.8) | las anteriores | Endpoint de inicio que une ambas recomendaciones y adjunta las razones. |

## 9. chat

Entidades: `conversations`, `conversation_participants`, `messages`.

| Funcionalidad | Entidades | Cómo construirla |
| --- | --- | --- |
| Contactar al arrendador desde un anuncio (5.7, 10.2) | `conversations`, `conversation_participants`, `properties` | `POST /properties/:id/contact`: crea el chat de renta (único por propiedad e interesado), con sus dos participantes. Exige identidad verificada y propiedad activa. |
| Chat de roomies al hacer match (10.3) | `conversations` | Lo crea el módulo de matching mediante el servicio de chat. |
| Lista de conversaciones con pestañas y no leídos (10.1) | `conversations`, `conversation_participants`, `messages` | Filtrar por tipo y participante, ordenar por `last_message_at`; no leídos con `last_read_at`. |
| Cabecera con la propiedad (10.2) | `conversations`, `properties` | Incluir un resumen de la propiedad en el detalle del chat de renta. |
| Enviar texto e imágenes (10.4) | `messages`, `media_assets` | REST y WebSocket; idempotencia con `client_message_id`; valida pertenencia, chat activo, bloqueos y propiedad de la imagen. |
| Tiempo real (10.6) | `messages` | `Gateway` de NestJS con Socket.IO, autenticado con JWT y una sala por conversación. Si hay varias instancias, un adaptador con Redis. |
| Estados enviado, entregado y leído (10.6) | `messages.delivered_at`, `read_at`, `conversation_participants.last_read_at` | El cliente confirma la entrega y marca como leído; el servidor actualiza y emite el evento. |
| Historial paginado (10.5) | `messages` | Paginación por cursor con el `id` del mensaje. |
| Cerrar conversaciones | `conversations.status`, `closed_reason` | Método `close(reason)` que usan matching, safety y accounts. |
| Bloquear y reportar desde el chat (10.7) | — | Delega en el módulo de seguridad. |

## 10. safety

Entidades: `user_blocks`, `reports`.

| Funcionalidad | Entidades | Cómo construirla |
| --- | --- | --- |
| Bloquear usuarios (6.3, 10.7) | `user_blocks` | Inserta el bloqueo y emite un evento que cierra el chat y deshace el match. |
| Ocultar bloqueados en todo el sistema (6.3) | `user_blocks` | `BlockedFilter` aplicado en búsquedas, matching, chat y compatibilidad. |
| Reportar perfiles, anuncios y mensajes (6.4) | `reports`, `media_assets` | `POST /reports` con un solo objetivo, motivo y evidencia opcional (imagen tipo `report_evidence`). |
| Consejos de seguridad (6.1) | — | Contenido estático mostrado en la app. |
| Revisar reportes sin panel | `reports.status` | Consulta interna o script con estados `open`, `in_review`, `resolved`, `dismissed`. Falta definir el procedimiento. |

## 11. notifications

Entidades: `notifications`, `notification_preferences`, `push_devices`, `audit_logs`.

| Funcionalidad | Entidades | Cómo construirla |
| --- | --- | --- |
| Registrar dispositivo para push (8.4) | `push_devices` | `POST /devices`; si el token existe, reasignarlo al usuario actual; revocarlo al cerrar sesión. |
| Crear notificaciones (8.3) | `notifications` | `NotificationsService.notify(userId, kind, data)`, llamado desde eventos de matching, chat, properties y verificación. Siempre se guarda primero. |
| Entrega por push y correo (8.4) | `push_devices`, `notification_preferences` | Tarea en cola que consulta las preferencias y envía por FCM o por el proveedor de correo. |
| Centro de notificaciones (8.1) | `notifications` | Listado paginado, contador de no leídas y marcado como leídas. |
| Preferencias por tipo y canal (8.2) | `notification_preferences` | `GET/PUT /me/notification-preferences`; si no hay fila, vale activado. |
| Auditoría de acciones críticas | `audit_logs` | `AuditService.log()` de solo inserción, llamado desde verificación y eliminación de cuenta. |

## Orden sugerido de desarrollo

| Fase | Módulos | Por qué en este orden |
| --- | --- | --- |
| 0 | Proyecto base, migraciones, `catalog`, piezas compartidas | Todo lo demás depende de la base, las guías y los catálogos. |
| 1 | `accounts`, `media`, `privacy` (ajustes y verificación simulada) | Sin cuentas ni archivos no se puede construir perfil ni anuncios. La verificación simulada desbloquea las acciones restringidas. |
| 2 | `profiles` | Los datos del perfil alimentan búsqueda, match y compatibilidad. |
| 3 | `properties` | Publicar y buscar es independiente del match y se puede probar solo. |
| 4 | `compatibility`, `matching`, `safety` (bloqueos) | El match necesita la compatibilidad y el filtro de bloqueos desde el inicio. |
| 5 | `chat`, `notifications` | Dependen de los matches y de las propiedades; el tiempo real es lo más complejo. |
| 6 | Proveedor real de verificación, moderación de imágenes, reportes, ARCO y auditoría | Integraciones externas que se pueden sustituir sin cambiar el resto. |

## Pendientes que afectan al desarrollo

- Quién revisa los anuncios nuevos y los reportes, ya que no hay panel.
- Proveedor de verificación de identidad y límite de reintentos.
- Campos obligatorios y fórmula de completitud del perfil.
- Pesos iniciales de compatibilidad y límite diario de intereses.
- Política de conservación de datos al terminar los 30 días.
