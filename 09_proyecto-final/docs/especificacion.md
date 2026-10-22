# OEE Live — Especificación del proyecto

Plataforma web para monitorear máquinas de producción en tiempo real vía Modbus TCP y calcular OEE (disponibilidad, rendimiento, calidad) por máquina, turno y planta.

Producto: SaaS para plantas pequeñas y medianas que no tienen MES. Conectan sus máquinas, ven el estado en vivo, reciben alertas y miden OEE sin licencias caras.

Este documento es la fuente de verdad. Backend y frontend se construyen contra este contrato.

---

## 1. Requisitos del bootcamp y cómo se cubren

| Requisito base | En OEE Live |
|---|---|
| Multi-idioma | es / en en toda la UI, correos localizados según el idioma del usuario, la API devuelve códigos de error y no textos |
| Zona pública con SEO y responsive | Landing, tablero en vivo de plantas públicas, detalle de máquina con URL amigable, SSR, metadatos, sitemap, hreflang |
| Zona privada con login | App de administración: plantas, máquinas, turnos, miembros, alertas, reportes |
| API REST | FastAPI `/api/v1` con documentación OpenAPI |
| Registro / login / logout / recuperar contraseña / editar datos / baja | Igual que en los modelos; la baja borra toda la información del usuario |
| Usuario o email únicos | Validación en backend y verificación de disponibilidad en el formulario |
| CRUD con imagen y versiones responsive | Máquinas con foto en 320 / 768 / 1280 px (webp) |
| Listados con límite, orden y paginación | Máquinas, eventos, notificaciones y plantas públicas, con anterior/siguiente solo si existen |
| Buscador con filtros | Máquinas por nombre, estado y marca; eventos por rango de fechas y estado |
| Favoritos | Lista de seguimiento de máquinas |
| Notificaciones en tiempo real o por email si no está conectado | Máquina caída, OEE bajo el umbral, máquina sin conexión: toast en vivo por WebSocket o email con enlace al detalle y para dejar de seguir |
| Compartir en redes | Detalle público de máquina o planta: X, Facebook, LinkedIn, WhatsApp |
| Roles | Anónimo, owner, supervisor, viewer (por planta) |
| Estados de interfaz | Cargando, ideal, error, vacío y en progreso en cada componente de datos |
| Desplegado en internet | VPS con Docker Compose y Caddy (HTTPS automático) |
| Valor extra | Simulador Modbus de máquinas, colector en tiempo real, clasificación de paros, reporte CSV |

---

## 2. Arquitectura

```
simulator (pymodbus, Modbus TCP :5020, control HTTP :8100)
      │  Modbus TCP
      ▼
collector (async, polling 1 s)  ──►  PostgreSQL
      │ publica en Redis pub/sub
      ▼
api (FastAPI :8000, REST + WebSocket)  ◄──  frontend (Next.js :3000)
      │
      └── SMTP (Mailpit en dev)

caddy (:80/:443) → /api y /ws → api ; todo lo demás → frontend
```

Monorepo:

```
oee-live/
  backend/        api + collector (mismo paquete, distinto entrypoint)
  simulator/
  frontend/
  docs/especificacion.md
  docker-compose.yml
  docker-compose.prod.yml
  Caddyfile
  .env.example
  README.md
```

---

## 3. Stack

- Backend: Python 3.12, FastAPI, SQLAlchemy 2 (async) + asyncpg, Alembic, Pydantic v2, PyJWT, argon2-cffi, redis (asyncio), pymodbus 3, Pillow, aiosmtplib + Jinja2, pytest.
- Simulador: Python 3.12, pymodbus 3 (servidor TCP), FastAPI para el control.
- Frontend: Next.js (App Router, TypeScript), next-intl, TanStack Query, react-hook-form + zod, Tailwind CSS, Recharts, MSW para mocks.
- Infra: PostgreSQL 16, Redis 7, Mailpit (dev), Caddy, Docker Compose.

---

## 4. Simulador Modbus

Un servidor Modbus TCP en el puerto 5020. Cada máquina es un `unit_id` (1..N). Configuración en `simulator/machines.yaml`:

```yaml
machines:
  - unit_id: 1
    name: Inyectora 01
    ideal_cycle_s: 28.0
    cycle_jitter: 0.08        # variación del ciclo real
    scrap_rate: 0.02
    mtbf_min: 45              # tiempo medio entre fallas
    mttr_min: 6               # tiempo medio de reparación
    micro_stop_prob: 0.03     # probabilidad de paro corto por ciclo
    idle_prob: 0.01
```

Mapa de holding registers (por unit_id):

| Dir | Campo | Tipo | Notas |
|---|---|---|---|
| 0 | state | uint16 | 0 = idle, 1 = running, 2 = down |
| 1–2 | good_count | uint32 (hi, lo) | monotónico, puede reiniciarse |
| 3–4 | reject_count | uint32 (hi, lo) | monotónico, puede reiniciarse |
| 5 | alarm_code | uint16 | 0 = sin alarma; ver catálogo de paros |
| 6 | last_cycle_ds | uint16 | ciclo real en décimas de segundo |
| 7 | heartbeat | uint16 | +1 por segundo, regresa a 0 tras 65535 |
| 8 | ideal_cycle_ds | uint16 | ciclo ideal en décimas de segundo |

Control HTTP (para la demo):

- `GET /machines` estado de todas
- `POST /machines/{unit_id}/fault` body `{"alarm_code": 3, "duration_s": 120}`
- `POST /machines/{unit_id}/disconnect` deja de actualizar el heartbeat durante `duration_s`
- `POST /machines/{unit_id}/reset-counters`

---

## 5. Colector

Proceso aparte: `python -m app.collector`.

- Lee cada máquina activa cada 1 s (host, puerto y unit_id vienen de la tabla `machines`). Recarga la lista de máquinas cada 30 s.
- Contadores: delta = actual − anterior. Si actual < anterior se toma como reinicio y delta = actual. El wrap de uint32 se maneja igual.
- OFFLINE: 3 lecturas fallidas seguidas o heartbeat sin cambio durante 5 s.
- Cambio de estado: cierra el evento abierto (`ended_at`) y abre uno nuevo. El código de alarma se guarda como `reason_code` inicial.
- Acumula en buckets de 1 minuto con upsert sobre `(machine_id, bucket_start)`: good, reject, run_s, idle_s, down_s, offline_s.
- Publica en Redis `plant:{plant_id}:live` un snapshot por máquina cada 2 s como máximo.
- Evalúa las reglas de alerta y crea notificaciones (sección 9).

---

## 6. Cálculo de OEE

Para una ventana [from, to):

- `planned_s` = segundos de la ventana que caen dentro de turnos de la planta. Si la planta no tiene turnos, toda la ventana.
- `run_s` = segundos en RUNNING dentro del tiempo planeado.
- `total` = good + reject.
- Disponibilidad A = run_s / planned_s
- Rendimiento P = (ideal_cycle_s × total) / run_s, con tope en 1.0
- Calidad Q = good / total
- OEE = A × P × Q

Si un denominador es 0, el valor es `null`, no 0. Lo que pase fuera de turno no cuenta en ninguna métrica. Granularidades: `hour`, `shift`, `day`.

---

## 7. Modelo de datos

- `users`: id, username (único, slug), email (único), full_name, password_hash, language (es|en), created_at
- `plants`: id, slug (único), name, timezone, is_public, created_at
- `plant_members`: plant_id, user_id, role (owner|supervisor|viewer). Quien crea la planta queda como owner.
- `machines`: id, plant_id, slug (único por planta), name, brand, model, host, port, unit_id, ideal_cycle_s, is_active, photo_key, created_at
- `shifts`: id, plant_id, name, start_time, end_time, days_of_week (int[]); un turno puede cruzar medianoche
- `downtime_reasons`: code, label_es, label_en, category (mecanica|electrica|material|calidad|organizacional|otro)
- `machine_events`: id, machine_id, state (RUNNING|IDLE|DOWN|OFFLINE), reason_code, comment, classified_by, started_at, ended_at
- `production_minutes`: machine_id, bucket_start, good, reject, run_s, idle_s, down_s, offline_s (PK compuesta)
- `alert_rules`: id, plant_id, machine_id (nullable, null = toda la planta), type (MACHINE_DOWN|MACHINE_OFFLINE|OEE_BELOW), threshold, duration_s, is_active
- `notifications`: id, user_id, type, payload (jsonb), created_at, read_at, emailed_at
- `watchlist`: user_id, machine_id
- `password_reset_tokens`: token_hash, user_id, expires_at, used_at
- `refresh_tokens`: token_hash, user_id, expires_at, revoked_at

Borrar un usuario borra sus memberships, watchlist, notificaciones y tokens. Si era el único owner de una planta, la planta se borra también; el frontend lo advierte antes de confirmar.

---

## 8. API REST — `/api/v1`

Formato de error:

```json
{ "error": { "code": "USERNAME_TAKEN", "field": "username" } }
```

Códigos: `VALIDATION_ERROR`, `USERNAME_TAKEN`, `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `NOT_AUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_TOKEN`, `WRONG_PASSWORD`, `MODBUS_UNREACHABLE`, `SLUG_TAKEN`, `FILE_TOO_LARGE`, `UNSUPPORTED_FILE`.

Paginación (en todos los listados):

```json
{ "items": [], "page": 1, "page_size": 20, "total": 134, "has_next": true, "has_prev": false }
```

Fechas en ISO 8601 UTC. El frontend convierte a la zona horaria de la planta.

### Auth

- Access token JWT de 15 min, que se devuelve en el body. Refresh token en cookie httpOnly, Secure, SameSite=Lax, path `/api/v1/auth`, 14 días, con rotación.
- `POST /auth/register` `{username, email, full_name, password, language}` → 201 `{user, access_token}`
- `POST /auth/login` `{username, password}` → `{user, access_token}`
- `POST /auth/refresh` → `{access_token}`
- `POST /auth/logout` → 204
- `POST /auth/password/forgot` `{email}` → siempre 204
- `POST /auth/password/reset` `{token, new_password}` → 204
- `GET /auth/availability?username=&email=` → `{username_available, email_available}`

### Usuario

- `GET /me` → `{id, username, email, full_name, language, created_at}`
- `PATCH /me` `{username?, email?, full_name?, language?}`
- `PUT /me/password` `{current_password, new_password}`
- `DELETE /me` `{password}` → 204

### Público (sin auth)

- `GET /public/plants?page=` plantas con `is_public = true`, más recientes primero
- `GET /public/plants/{plant_slug}` → planta + máquinas con snapshot actual + OEE de hoy
- `GET /public/plants/{plant_slug}/machines/{machine_slug}` → detalle + OEE de hoy + tendencia por hora de las últimas 12 h

Nunca exponen host, puerto, unit_id, miembros ni comentarios.

### Plantas y miembros

- `GET /plants` las mías con mi rol · `POST /plants` `{name, timezone, is_public}`
- `GET /plants/{id}` · `PATCH /plants/{id}` (owner) · `DELETE /plants/{id}` (owner)
- `GET /plants/{id}/members` · `POST /plants/{id}/members` `{username, role}` (owner)
- `PATCH /plants/{id}/members/{user_id}` `{role}` · `DELETE /plants/{id}/members/{user_id}` (owner; no se puede quitar al último owner)

### Máquinas

- `GET /plants/{id}/machines?search=&state=&brand=&page=&page_size=` ordenadas por nombre
- `POST /plants/{id}/machines` (owner, supervisor) `{name, brand, model, host, port, unit_id, ideal_cycle_s, is_active}`
- `GET /machines/{id}` → incluye `snapshot` y `photo` `{sm, md, lg}`
- `PATCH /machines/{id}` · `DELETE /machines/{id}` (owner, supervisor)
- `POST /machines/{id}/photo` multipart, máximo 5 MB, jpg/png/webp → genera 320/768/1280 en webp
- `POST /machines/{id}/test-connection` → `{ok, latency_ms, registers}` o `MODBUS_UNREACHABLE`

Snapshot:

```json
{ "state": "RUNNING", "since": "...", "good": 1520, "reject": 31, "alarm_code": 0,
  "last_cycle_s": 28.4, "oee_today": { "availability": 0.91, "performance": 0.95, "quality": 0.98, "oee": 0.85 } }
```

### Turnos

- `GET/POST /plants/{id}/shifts` · `PATCH/DELETE /shifts/{id}`

### OEE y eventos

- `GET /machines/{id}/oee?from=&to=&granularity=hour|shift|day` → `[{bucket_start, availability, performance, quality, oee, good, reject, run_s, planned_s}]`
- `GET /plants/{id}/oee/summary?date=YYYY-MM-DD` → `{plant: {...}, machines: [{machine_id, name, ...métricas}]}`
- `GET /machines/{id}/events?from=&to=&state=&page=` más recientes primero
- `PATCH /events/{id}` `{reason_code, comment}` (owner, supervisor)
- `GET /downtime-reasons`
- `GET /plants/{id}/reports/oee.csv?from=&to=`

### Alertas, notificaciones y seguimiento

- `GET/POST /plants/{id}/alert-rules` · `PATCH/DELETE /alert-rules/{id}`
- `GET /notifications?unread=true&page=` · `POST /notifications/{id}/read` · `POST /notifications/read-all`
- `GET /watchlist` · `PUT /watchlist/{machine_id}` · `DELETE /watchlist/{machine_id}`
- `GET /watchlist/unfollow?token=` enlace firmado de un clic para el correo → redirige al frontend

---

## 9. Tiempo real y notificaciones

WebSocket privado: `/ws?token=<access_token>`

- Cliente → `{"type": "subscribe", "plant_id": 3}` / `{"type": "unsubscribe", "plant_id": 3}`
- Servidor → `{"type": "machine.snapshot", "plant_id": 3, "machine_id": 12, "snapshot": {...}, "ts": "..."}`
- Servidor → `{"type": "notification", "notification": {...}}`
- Servidor → `{"type": "ping"}` cada 25 s

WebSocket público: `/ws/public/{plant_slug}`, solo `machine.snapshot`.

Reglas:

- `MACHINE_DOWN`: DOWN por más de `duration_s`
- `MACHINE_OFFLINE`: OFFLINE por más de `duration_s`
- `OEE_BELOW`: OEE del turno actual menor a `threshold` (se evalúa cada 5 min; una notificación por turno)

Destinatarios: los usuarios que tienen la máquina en seguimiento. En reglas de planta, todos los miembros.

Entrega: si el usuario tiene un WebSocket activo, va por ahí. Si no, va por email en su idioma con enlace al detalle de la máquina y enlace para dejar de seguirla. No se repite la misma alerta para el mismo evento.

Payload de notificación:

```json
{ "id": 1, "type": "MACHINE_DOWN", "created_at": "...", "read_at": null,
  "payload": { "plant_id": 3, "machine_id": 12, "machine_name": "Inyectora 01", "reason_code": "3", "duration_s": 180 } }
```

---

## 10. Datos demo (seed)

- Usuario `demo` / `Demo1234!`, idioma es.
- Planta pública "Planta Demo SLP" (`planta-demo-slp`), zona horaria America/Mexico_City, 3 turnos de 8 h.
- 8 máquinas que apuntan a `simulator:5020`, unit_id 1..8.
- 7 días de `production_minutes` y `machine_events` históricos generados con los mismos perfiles del simulador, para que las gráficas tengan datos desde el primer arranque.
- Catálogo de 12 motivos de paro.
