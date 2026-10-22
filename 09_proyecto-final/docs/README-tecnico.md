# OEE Live · referencia técnica

Aplicación para conectar máquinas por Modbus TCP, consultar su estado y calcular disponibilidad, rendimiento, calidad y OEE por máquina, turno y planta. El contrato está en [docs/especificacion.md](docs/especificacion.md); el resumen para evaluación está en el README de la carpeta.

## Abrir el frontend en desarrollo

Con las dependencias de `frontend/` instaladas, puedes ejecutar desde la raíz:

```sh
npm run dev
```

Abre `http://localhost:3000/es`. Si OEE Live ya está ejecutándose en ese puerto,
el comando muestra la dirección y conserva la instancia existente. Este comando
inicia el frontend; la API y los servicios se levantan según las secciones siguientes.

También puedes ejecutar `pnpm dev` dentro de `frontend/`. Las dependencias del
frontend se instalan con `pnpm --dir frontend install`; el package.json raíz no
tiene dependencias y solo ofrece el comando de arranque. La cuenta del seed es
`demo` / `Demo1234!`.

## Backend y servicios locales

Requiere Docker Engine con Docker Compose. Desde la raíz del repositorio, copia `.env.example` como `.env` y ejecuta:

```sh
docker compose up --build -d
docker compose exec api python -m app.seed
```

El primer comando arranca PostgreSQL 16, Redis 7, Mailpit, API, simulador, colector y frontend. El servicio `migrate` aplica Alembic antes de que arranque la API; el frontend espera a que esta esté disponible. El segundo crea los datos de demostración: usuario `demo`, contraseña `Demo1234!`, planta pública `planta-demo-slp`, ocho máquinas, tres turnos y siete días de histórico. La carga demo es opcional en un despliegue con datos reales.

| Servicio | Dirección local |
|---|---|
| Frontend | `http://localhost:3000` |
| API y OpenAPI | `http://localhost:8000/api/v1/docs` |
| Estado de API | `http://localhost:8000/api/v1/health` |
| WebSocket privado | `ws://localhost:8000/ws` |
| WebSocket público demo | `ws://localhost:8000/ws/public/planta-demo-slp` |
| Buzón de desarrollo | `http://localhost:8025` |
| Control HTTP del simulador | `http://localhost:8100/machines` |
| Modbus TCP | `localhost:5020` |

Los puertos publicados en desarrollo se enlazan a `127.0.0.1`. Si algún puerto ya está ocupado, cambia `POSTGRES_PORT`, `REDIS_PORT`, `API_PORT`, `SMTP_PORT`, `MAILPIT_HTTP_PORT`, `SIMULATOR_MODBUS_PORT` o `SIMULATOR_HTTP_PORT` en `.env`. Las conexiones internas de Compose mantienen los puertos propios de cada servicio. Al cambiar el puerto público de la API, actualiza también `PUBLIC_API_URL` y las variables públicas del frontend.

Compose compila el frontend con `NEXT_PUBLIC_API_MOCKING=false` y las URLs públicas de `.env`; SSR usa `http://api:8000/api/v1`. Para desarrollar el frontend por separado, detén su contenedor con `docker compose stop frontend` y sigue [frontend/README.md](frontend/README.md). En ese caso configura `frontend/.env.local` a partir de su ejemplo, con mocks desactivados y `API_URL_INTERNAL=http://localhost:8000/api/v1`; el archivo `.env` de la raíz no se carga automáticamente en Next.js.

```sh
docker compose logs --tail=100 api collector simulator
docker compose ps
docker compose stop
```

Las fotos y PostgreSQL se guardan en volúmenes. Detener los servicios conserva esos datos.

## Ejecutar el backend sin contenedores

Instala Python 3.12 y uv. PostgreSQL, Redis y un SMTP de desarrollo deben estar accesibles según `.env`. Desde `backend/`:

```sh
uv sync --python 3.12
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

El colector es otro proceso:

```sh
uv run python -m app.collector
```

El simulador se ejecuta desde su carpeta, según [simulator/README.md](simulator/README.md). Fuera de Compose, las máquinas deben apuntar a `127.0.0.1:5020`, no al hostname interno `simulator`. Se puede ajustar su conexión desde la API con permisos owner o supervisor.

## Configuración

Los valores se leen desde `.env` en la raíz y, si existe, `backend/.env`; las variables del proceso tienen prioridad. La configuración distingue `development`, `test` y `production` mediante `ENVIRONMENT`.

| Variable | Uso |
|---|---|
| `DATABASE_URL` | URL SQLAlchemy con controlador `postgresql+asyncpg`. SQLite se reserva para pruebas. |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Inicialización y conexión interna de PostgreSQL en Compose. |
| `REDIS_URL` | Redis para snapshots, presencia, publicación de eventos y estado del colector. |
| `JWT_SECRET` | Firma de tokens; al menos 32 caracteres. El valor de desarrollo no es válido en producción. |
| `FRONTEND_URL` | Origen HTTP/HTTPS exacto para CORS, enlaces y redirecciones, sin ruta. |
| `PUBLIC_API_URL` | Dirección pública de la API, incluyendo `/api/v1`; se usa en enlaces de correo. |
| `UPLOAD_DIR` | Directorio de fotos; `/data/uploads` en las imágenes. |
| `SMTP_HOST`, `SMTP_PORT` | Servidor de correo; Mailpit en desarrollo. |
| `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_STARTTLS` | Autenticación, remitente y STARTTLS del servidor SMTP. |
| `ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS` | Duración de sesión: 15 minutos y 14 días. |
| `SIMULATOR_SEED` | Semilla de los perfiles de producción simulados. |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_SITE_URL` | URLs visibles por el navegador; se fijan al compilar el frontend. |
| `NEXT_PUBLIC_API_MOCKING` | `false` para integración real y producción. |
| `API_URL_INTERNAL` | Base de la API usada por SSR; `http://api:8000/api/v1` dentro de Compose. |
| `DOMAIN`, `ACME_EMAIL` | Dominio público y correo para certificados de Caddy. |

La cookie de refresh siempre tiene `Secure`, `HttpOnly`, `SameSite=Lax`, sin `Domain` y con path `/api/v1/auth`. En desarrollo HTTP sobre `localhost` se utilizan Chromium o Firefox. La marca de navegación del frontend no acredita identidad: la API y los WebSockets verifican JWT y permisos de planta.

## Arquitectura

```text
simulator:5020 -- Modbus TCP --> collector -- lotes --> PostgreSQL
                                    |
                                    +-- snapshots --> Redis pub/sub
                                                          |
frontend:3000 <-- REST / WebSocket --> api:8000 <-----------+
                                         |
                                         +-- notificaciones --> SMTP

Caddy:80/443 --> /api y /ws --> api:8000
            --> resto ------> frontend:3000
```

`backend/app/models` contiene los modelos y `backend/alembic` las migraciones. La API usa sesiones asíncronas con SQLAlchemy y asyncpg. El colector se ejecuta por separado y comparte las mismas tablas y servicios de cálculo.

- Las pertenencias y roles se verifican por planta. Un recurso de una planta ajena responde 404; un miembro sin el rol necesario recibe 403.
- Los tokens de refresh y recuperación se almacenan hasheados. El refresh rota y su familia permite revocar una cadena reutilizada.
- Los timestamps se guardan en UTC con zona. Los turnos se interpretan en la zona IANA de la planta, incluyendo medianoche y cambios horarios.
- Los eventos tienen un índice único parcial que permite un solo evento abierto por máquina. Los códigos de alarma desconocidos se conservan sin forzar su existencia en el catálogo.
- Los minutos de producción almacenan deltas y segundos decimales. `production_samples` conserva los instantes de los deltas positivos para calcular ventanas parciales sin repartir piezas de forma artificial.
- `machine_checkpoints` conserva contadores absolutos y el último instante observado en la misma transacción que la producción. Ante una caída del colector, las consultas cortan el tiempo de marcha en ese instante y devuelven OFFLINE; Redis puede reconstruirse desde esa evidencia persistente.
- OEE excluye el tiempo fuera de turno, une turnos solapados, limita rendimiento a 1 y devuelve `null` ante un divisor cero. Los agregados de planta se calculan con acumulados, no promediando porcentajes.
- Las notificaciones llevan una clave de deduplicación por destinatario y una marca persistente de entrega. Los datos internos de entrega no forman parte del DTO público.
- Las claves foráneas eliminan relaciones dependientes y anonimizan la clasificación de eventos. La eliminación de plantas cuyo único owner se da de baja se resuelve dentro de la transacción de usuario.

## Planta de inyección

La migración `0004_injection_context` incorpora líneas, productos, moldes, resinas,
lotes, recetas, órdenes, corridas y trazabilidad de material y personal. Los
catálogos pertenecen a una planta. Una corrida congela los estándares y el contexto
de fabricación: modificar un molde o una receta después no reescribe su historia.
Solo se permite una corrida abierta por máquina y por molde. Los catálogos se
desactivan mediante `is_active`; sus referencias siguen protegidas.

`ideal_cycle_s` de la receta/corrida expresa **segundos por disparo**. Dividirlo
entre `active_cavities` da el tiempo ideal por pieza; los contadores Modbus ya son
piezas. El OEE pondera las muestras según su corrida, preserva los contadores
observados y conserva el cálculo anterior donde no existen corridas. El CSV añade
`ideal_seconds` para agregar correctamente distintos productos y moldes. Si un
minuto cambia de estándar y no hay muestras que permitan atribuir sus piezas,
se conservan cantidades y disponibilidad, pero rendimiento/OEE quedan en null.

Los paros de línea se abren con un motivo del catálogo y se cierran explícitamente.
Guardan las máquinas activas afectadas en ese momento. Su tiempo se resta de la
marcha dentro de turno, uniendo los solapamientos con paros de máquina; `planned`
clasifica el paro y no elimina tiempo programado. El estado Modbus observado
permanece disponible por separado.

La telemetría almacena valores, unidades, datos crudos, calidad y versión del mapa
por muestra, con referencia a la corrida. Una lectura fallida o no disponible es
`null` con calidad bad/unavailable; un valor obsoleto se marca stale. Nunca se
sustituyen faltantes por ceros. Los registros
0..8 del protocolo base se conservan; los mapas de proceso configurables empiezan
en 9. El mapa del simulador está documentado en `simulator/README.md`; no representa
las direcciones confirmadas de equipos físicos. El colector solo lee.

El seed agrega ocho configuraciones de inyección de 1, 2 y 4 cavidades y sus
catálogos demo de forma idempotente. Reutiliza las máquinas del demo anterior por
identidad y mantiene sus datos históricos; no inventa telemetría pasada. Las
rutas y los DTOs están documentados en `/api/v1/docs`, y el contrato completo en
`docs/especificacion.md`.

## Tablero de planta e históricos

`GET /api/v1/plants/{id}/board` reúne estados observados, OEE ponderado del día,
líneas, posiciones, corridas activas con producto/molde/cavidades y paros abiertos.
Requiere pertenecer a la planta. El snapshot conserva el contrato de WebSocket;
los comentarios y el contexto productivo no se añaden a los tableros públicos.
`scheduled_now` indica si hay turno y `without_active_run` cuenta máquinas activas
sin corrida: ninguno representa cumplimiento de una programación por orden.

La migración `0005_machine_board_positions` permite guardar la distribución con
`GET/PUT /api/v1/plants/{id}/layout`. Owner y supervisor pueden reemplazar las
posiciones de su planta; cualquier miembro puede leerlas. Cada posición tiene
`machine_id`, `x`, `y`, `width`, `height` y `rotation` (0/90/180/270). La caja usa
coordenadas normalizadas entre 0 y 1 y debe caber en el plano. Enviar
`{"positions":[]}` elimina las posiciones manuales; la interfaz distribuye las
máquinas sin posición guardada automáticamente.

Para gráficas, `GET /api/v1/machines/{id}/telemetry/series` recibe `from` y `to`
con zona horaria y entre 1 y 12 parámetros `codes` repetidos. Por ejemplo:
`?from=2026-10-21T00:00:00Z&to=2026-10-22T00:00:00Z&codes=cycle_time_s&codes=filling_time_s`.
El intervalo es `[from,to)`, con máximo de 31 días. `max_points` limita cada serie
(600 por defecto, entre 10 y 2000); `bucket_s` permite elegir el intervalo en
segundos y `run_id` filtrar una corrida de esa máquina. El servidor agrega todas
las muestras del rango en SQL y rechaza respuestas de más de 24000 puntos, sin
truncarlas. El último bucket puede ser parcial y los buckets empiezan en `from`.

Cada variante de código/unidad/mapa devuelve promedio, mínimo, máximo, primera y
última lectura válida, sus fechas y conteos de calidad. Solo `good` participa en
los estadísticos. Los huecos tienen valores nulos, nunca cero; las gráficas no
deben interpolarlos. Cambios de mapa o unidad producen series separadas. Para
agregar promedios se pondera por `counts.good`; mínimo y máximo proceden de las
lecturas originales. La tabla raw paginada conserva su endpoint independiente.

Los históricos OEE por hora/turno/día y el CSV de producción siguen disponibles.
El seed genera históricos de producción del demo, pero no inventa telemetría de
proceso anterior al arranque del colector. Por ello ambos históricos pueden tener
fechas iniciales distintas. Los datos del simulador no son lecturas de equipos
físicos.

## Pruebas y migraciones

Desde `backend/`:

```sh
uv run pytest -q
uv run ruff check app tests alembic
uv run ruff format --check app tests alembic
uv run alembic check
```

`alembic check` compara la base configurada con los modelos y requiere haber aplicado las migraciones. Las pruebas unitarias de persistencia utilizan SQLite con claves foráneas activas. Las migraciones iniciales se verificaron también en PostgreSQL 17 aislado mediante subida, comprobación, reversión y nueva subida; el destino de Compose sigue siendo PostgreSQL 16. Las pruebas locales de Redis pueden utilizar un emulador compatible, por lo que no sustituyen la ejecución integrada con Redis 7.

La máquina de desarrollo no tiene Docker Engine. Ambos archivos Compose pasaron `config --quiet` con el cliente oficial independiente; los builds y la ejecución completa de contenedores requieren verificación en un equipo con Docker.

## Despliegue con HTTPS

`docker-compose.prod.yml` es un archivo independiente: úsalo sin combinarlo con el de desarrollo. Solo Caddy publica puertos; PostgreSQL, Redis y el control del simulador quedan dentro de la red de Compose. Se necesita un VPS con Docker, DNS del dominio apuntando al servidor y puertos 80/443 disponibles.

Ambas configuraciones incluyen el frontend mediante `frontend/Dockerfile`, con sus cuatro argumentos públicos de build y `API_URL_INTERNAL` en ejecución. La imagen usa la salida standalone y un usuario sin privilegios. En producción, las URLs del navegador se construyen desde `DOMAIN`; el tráfico interno entre frontend y API permanece en la red de Compose.

Configura `DOMAIN`, `ACME_EMAIL`, una contraseña nueva de PostgreSQL, un `JWT_SECRET` aleatorio y el servidor SMTP. Usa una contraseña de base de datos compatible con URL o codifica sus caracteres reservados en la URL de conexión. SMTP usa STARTTLS de forma predeterminada; `SMTP_USER` y `SMTP_PASSWORD` pueden quedar vacíos para un relay sin autenticación. El origen público y las URLs del frontend se derivan del dominio y usan HTTPS/WSS.

```sh
docker compose -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml logs --tail=100 api collector caddy
```

Elige credenciales diferentes de las incluidas en `.env.example` y conserva los volúmenes `postgres-data`, `uploads`, `redis-data` y `caddy-data` en la estrategia de respaldo del VPS. Los certificados y su renovación quedan a cargo de Caddy.

## Demo pública del examen

La demo utiliza PostgreSQL en la VM y combina `docker-compose.prod.yml` con
`docker-compose.demo.yml`; no utiliza ni modifica la configuración de Cloud SQL.
La VM `oee-demo` está en el proyecto `keepcoodingoee`, zona `us-central1-a`.
El dominio provisional previsto es `oee-live.34.57.59.112.sslip.io`; la publicación
se comprueba después de compilar, arrancar y validar HTTPS y la API.

Prepara un archivo privado `.env.demo` con `DOMAIN`, `ACME_EMAIL`,
`POSTGRES_PASSWORD` y `JWT_SECRET` propios del servidor. El correo de demostración
se configura de forma explícita:

```dotenv
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM="OEE Live Demo <noreply@oee-live.34.57.59.112.sslip.io>"
SMTP_STARTTLS=false
```

```sh
docker compose --env-file .env.demo -f docker-compose.prod.yml -f docker-compose.demo.yml config --quiet
docker compose --env-file .env.demo -f docker-compose.prod.yml -f docker-compose.demo.yml up --build -d
docker compose --env-file .env.demo -f docker-compose.prod.yml -f docker-compose.demo.yml exec api python -m app.seed
```

El overlay fuerza SMTP interno sin autenticación ni STARTTLS para API, migración
y colector. Mailpit captura los mensajes MIME de texto y HTML, con sus enlaces,
pero **no entrega correos a direcciones externas**. La recuperación de contraseña
y las alertas por correo solo pueden comprobarse mediante revisión administrativa
del buzón interno; el visitante no recibirá esos mensajes en su correo habitual.
El registro y el acceso con contraseña no dependen de un correo de confirmación.

Mailpit no publica puertos ni tiene una ruta en Caddy. Conserva como máximo 500
mensajes y usa almacenamiento temporal, sin volumen persistente. Solo Caddy
publica puertos del host. Todos los servicios limitan sus logs a tres archivos
de 10 MB. Caddy elimina `token` de las URLs registradas y omite `Referer`; la API
de esta demo desactiva access logs y mensajes INFO de Uvicorn para no registrar
el token de WebSocket. No se altera el token que recibe la aplicación.

El simulador queda activo en este Compose; un seed nuevo configura sus máquinas
con `simulator:5020`. No se debe restaurar el entorno local suponiendo que
`127.0.0.1` identifica al simulador dentro de Docker. La preparación y acceso al
servidor están documentados en [docs/gcp-deployment.md](docs/gcp-deployment.md).

## Recolección y despliegue con Cloud SQL

El colector es un servicio independiente (`python -m app.collector`): consulta
Modbus TCP, persiste las lecturas y checkpoints en PostgreSQL y publica los
snapshots en Redis. API y frontend consumen esos datos; cerrar el navegador no
detiene la recolección. El proceso debe tener acceso de red a los equipos; en una
planta real esto requiere ubicarlo en su red o habilitar conectividad privada.
Cloud SQL aloja la base y no ejecuta el colector.

Los servicios del backend rotan sus logs a 10 MB por archivo, con tres archivos
por servicio. El colector dispone de 30 segundos para su parada ordenada y se
reinicia si termina inesperadamente. Su comprobación de salud valida que la
última señal tenga fecha válida y menos de diez segundos; la señal se publica
después de la persistencia SQL. Un estado Docker `unhealthy` informa del fallo;
la política de reinicio actúa sobre procesos terminados, no sobre ese estado.

```sh
docker compose -f docker-compose.prod.yml logs --tail=100 collector
docker compose -f docker-compose.prod.yml exec collector python -m app.collector.health
```

`docker-compose.cloud.yml` es una alternativa independiente para PostgreSQL
gestionado en Cloud SQL. No inicia otro PostgreSQL. API y colector reciben
`CLOUD_SQL_DATABASE_URL`, mientras que el trabajo de migración recibe una URL
administrativa distinta, `CLOUD_SQL_MIGRATION_DATABASE_URL`.

La instancia de desarrollo es `keepcodingoee:us-central1:oee-mes-dev`, con la base
`oee_dev`. Tras aplicar las migraciones, completa la contraseña administrativa
en `.env.cloud.local` y ejecuta desde la raíz:

Para instalaciones nuevas, `scripts/cloudsql-migrations.sql` contiene las
migraciones hasta 0005 y rechaza una base no vacía. Si la base ya está en 0003,
`scripts/cloudsql-injection-upgrade.sql` contiene únicamente la ampliación de
inyección hasta 0004; después, `scripts/cloudsql-layout-upgrade.sql` actualiza de
0004 a 0005. Los scripts de actualización verifican la revisión de origen.
Todos los scripts comprueban el destino;
se deben ejecutar con la cuenta administrativa, antes de renovar los permisos de
aplicación con el comando siguiente. La ampliación local no ejecuta esos scripts
contra Cloud SQL.

```powershell
backend/.venv/Scripts/python.exe scripts/configure-cloudsql.py
```

El comando verifica el destino y la revisión, prepara un usuario de aplicación
sin permisos administrativos ni edición de migraciones, comprueba su acceso y
genera `backend/.env` y `.env.cloud.runtime`. Ambos archivos están excluidos de
Git y los secretos no se imprimen. La conexión directa utiliza TLS (`ssl=require`);
la autorización de la IP de salida del servidor también debe estar configurada.

Antes de publicar, completa el dominio, correo ACME y SMTP en `.env.cloud.runtime`
y prepara el servidor Docker y su DNS. Después:

```sh
docker compose --env-file .env.cloud.runtime -f docker-compose.cloud.yml config --quiet
docker compose --env-file .env.cloud.runtime -f docker-compose.cloud.yml up --build -d
docker compose --env-file .env.cloud.runtime -f docker-compose.cloud.yml logs --tail=100 api collector
```

El simulador se habilita explícitamente con `--profile demo` antes de `up`.
Mantiene el mismo protocolo Modbus que usa el colector. Sin ese perfil se
consultan los hosts configurados para las máquinas, sin generar lecturas falsas.
El control HTTP del simulador permanece dentro de la red de contenedores.
