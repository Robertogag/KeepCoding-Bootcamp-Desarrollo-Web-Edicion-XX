# OEE Live · Proyecto final del bootcamp

<p align="center">
  <img src="https://img.shields.io/badge/Proyecto-Final%20Full%20Stack-black?style=for-the-badge" alt="Proyecto final">
  <img src="https://img.shields.io/badge/Dominio-Manufactura%20%2F%20OEE-blue?style=for-the-badge" alt="Dominio">
  <img src="https://img.shields.io/badge/Stack-Next.js%2016%20%C2%B7%20FastAPI%20%C2%B7%20PostgreSQL%20%C2%B7%20Docker-success?style=for-the-badge" alt="Stack">
  <img src="https://img.shields.io/badge/Demo-GCP%20Cloud%20Run%20%2B%20VM-orange?style=for-the-badge" alt="Demo">
</p>

**Demo en línea:** https://oee-live-keepcoding.cloud.run
**Tablero público sin cuenta:** https://oee-live-keepcoding.cloud.run/es/plants/planta-demo-slp

> **Summary (EN).** OEE Live is a SaaS for small and mid-size plants that have no MES: it reads
> injection machines over Modbus TCP, shows their state in real time and computes Availability,
> Performance, Quality and OEE per machine, shift and plant, with alerts, downtime classification,
> production runs and formatted Excel reports. Next.js 16 frontend, FastAPI backend, PostgreSQL,
> Redis, a Modbus simulator and a collector, deployed on Google Cloud (VM + Cloud Run gateway).
> The online demo stays available for one week after delivery; afterwards, see *Ejecutarlo en
> localhost* below.

---

## 1. Objetivo de la aplicación

En una planta de inyección de plástico cada máquina sabe cuántos disparos dio, cuántas piezas
buenas produjo, cuánto tiempo estuvo en falla y qué código de alarma tuvo. Casi nadie lo lee: esa
información se queda en el PLC. OEE Live la conecta, la guarda y la convierte en el indicador que
usa toda la industria para medir una máquina: el **OEE**.

```
OEE = Disponibilidad × Rendimiento × Calidad
Disponibilidad = tiempo en marcha ÷ tiempo planificado
Rendimiento    = tiempo ideal ÷ tiempo en marcha   (tiempo ideal = piezas × estándar por pieza)
Calidad        = piezas buenas ÷ (buenas + rechazos)
```

Lo que resuelve, en orden de uso:

1. **Conectar** cada máquina por Modbus TCP (host, puerto, unit id) y leerla cada segundo.
2. **Ver** el plano de la planta con cada máquina teñida por su estado (en marcha, inactiva, falla,
   sin conexión), su OEE del día y su corrida vigente; una línea de tiempo de 8 horas por máquina.
3. **Clasificar** los paros con un motivo y un comentario, y saber quién lo hizo.
4. **Avisar** cuando una máquina cae, se desconecta o su OEE baja del umbral: en vivo por
   WebSocket y por correo si la persona no está conectada.
5. **Consultar** por rango y máquinas, y descargar un Excel con formato o el CSV.
6. **Compartir** un tablero público para quien no tiene cuenta, con SEO y URL amigable.

La demo simula una planta real de ocho inyectoras (cavidades 1, 2 y 4) con siete días de histórico
y producción continua: todo lo que se ve se está escribiendo en la base de datos en ese momento.

---

## 2. Para los profesores: cómo entrar y qué mirar

### Acceso

| Qué | Dónde |
|---|---|
| Aplicación | https://oee-live-keepcoding.cloud.run |
| Usuario de consulta (solo lectura) | usuario `demo` · contraseña `Demo1234!` (también aparece en la portada) |
| Tablero público sin cuenta | https://oee-live-keepcoding.cloud.run/es/plants/planta-demo-slp |
| Idiomas | selector es / en en la cabecera |
| Documentación del API | `https://oee-live-keepcoding.cloud.run/api/v1/docs` |

La cuenta `demo` es **operador**: ve tableros, históricos, paros y datos, recibe notificaciones y
sigue máquinas, pero no cambia la configuración. Las cuentas de propietario y supervisor existen y se
usan en el recorrido de pruebas; si se necesita una para la evaluación, se entrega aparte.

La demo en línea permanece **una semana** después de la entrega. Si ya no responde, el proyecto se
levanta completo en localhost con Docker en unos minutos (sección 7).

### Recorrido sugerido (5 minutos)

1. **Portada**: acceso, instrucciones y guía de uso en cuatro pasos.
2. **Tablero** de la planta: plano de piso con las ocho máquinas, totales por estado y OEE del día.
   Botón *Tarjetas* para la vista clásica y *Pantalla completa* para la pantalla de piso.
3. **Máquina** (clic en cualquiera): línea de tiempo de 8 h con tooltip (motivo del paro y quién lo
   clasificó), OEE de hoy, contadores del equipo (disparos, piezas, último ciclo), corrida vigente
   (producto, molde, resina, cavidades), variables de proceso en vivo, tendencia y eventos paginados.
4. **Paros**: fallas e inactividad de todas las máquinas con motivo, comentario y quién clasificó,
   más los paros de línea abiertos y su histórico.
5. **Datos**: rango, máquinas y vista (por máquina, por día, día × máquina). *Descargar Excel*
   genera un libro con portada, indicadores, tablas con semáforo y hoja de cálculo explicada.
6. **Campana** de la cabecera: las notificaciones reales (OEE bajo umbral, falla prolongada) se leen
   ahí mismo y llevan a la máquina. **Seguimiento**: máquinas favoritas con alertas.
7. **Configuración** (propietario o supervisor): catálogos de inyección, turnos, personal, reglas de
   alerta y ajustes de la planta.

### Limitaciones conocidas

- El correo de la demo se captura en un buzón interno (Mailpit); no sale a direcciones reales.
  La pantalla de recuperación de contraseña lo avisa.
- La entrada por Cloud Run arranca en frío si lleva un rato sin visitas: la primera petición puede
  tardar unos segundos.
- El endpoint CSV del servidor (`/reports/oee.csv`) recalcula cada máquina y día y tarda decenas
  de segundos; la pantalla de Datos ya no depende de él y genera el CSV en el navegador con las
  mismas columnas.

---

## 3. Recorrido con imágenes reales

Capturas tomadas de la demo en línea el 22 de octubre de 2026, con la cuenta de consulta. Cada
imagen corresponde a un módulo; debajo se explica qué se observa y de dónde sale el dato.

### Portada y acceso

![Portada: acceso, cuenta de demo y guía de uso](docs/images/01-portada.png)

La puerta de entrada. A la izquierda el formulario de acceso con la cuenta de demostración al
pie; a la derecha, los cuatro pasos para seguir una planta y el enlace al tablero público. El
fondo es una nave de inyección real.

### Tablero público (sin cuenta)

![Tablero público con las ocho máquinas en vivo](docs/images/02-tablero-publico.png)

Lo que ve cualquiera con el enlace: OEE de la planta hoy con sus tres factores, cuántas máquinas
hay en cada estado y una tarjeta por máquina con estado, tiempo en ese estado, OEE, A/P/Q y
contadores. Se actualiza por WebSocket; la página se renderiza en servidor para SEO.

### Mis plantas

![Mis plantas con la guía de uso](docs/images/03-mis-plantas.png)

Las plantas a las que pertenece la cuenta, con el puesto en cada una y su OEE del día. La guía
de uso se repite aquí para quien entra por primera vez.

### Tablero de planta: plano de piso

![Plano de piso: una ficha por máquina agrupada por línea](docs/images/04-tablero-plano.png)

La pantalla principal. Arriba, el conteo de máquinas por estado y el OEE de la planta con sus
tres factores; si hay paros de línea activos aparece una franja roja. Después, una ficha por
máquina agrupada por línea de producción: barra de estado (verde en marcha, ámbar inactiva, roja
falla, gris sin conexión), silueta de la inyectora teñida con ese estado, nombre y modelo, OEE
del día en grande con el semáforo, barras de disponibilidad, rendimiento y calidad, y la corrida
vigente (producto · molde · cavidades activas/nominales). Al pie, la franja de la práctica con el
reloj de la planta y cuántas máquinas tienen orden abierta.

### Tablero de planta: tarjetas

![Vista de tarjetas](docs/images/05-tablero-tarjetas.png)

La misma información en tarjetas con anillo de OEE, pensada para pantallas de piso.

### Detalle de máquina

![Detalle de máquina: línea de tiempo, OEE, contadores, corrida, telemetría](docs/images/06-maquina-detalle.png)

De arriba abajo: estado actual y acciones (seguir, histórico); línea de tiempo de las últimas
8 horas con un segmento por estado (al pasar el cursor muestra motivo, comentario y quién
clasificó el paro; con permisos, clic para clasificar); OEE de hoy con A, P y Q; contadores del
equipo (disparos, piezas buenas, rechazos, último ciclo real por disparo y estándar base por
pieza); la corrida vigente con producto, molde, resina, cavidades, ciclo por disparo e ideal por
pieza; variables de proceso leídas por Modbus con su calidad de dato y la tendencia del ciclo; la
tendencia de OEE por hora, turno o día, y la tabla de eventos paginada.

### Paros

![Paros de máquina y de línea](docs/images/07-paros.png)

Fallas (con código de alarma del equipo) e inactividad (sin ciclar) de todas las máquinas en el
rango elegido, con motivo, comentario y quién lo clasificó; el botón *Clasificar* abre el diálogo
con el catálogo de motivos. Debajo, los paros de línea abiertos manualmente y su histórico. Ambos
tipos restan disponibilidad en el OEE.

### Datos

![Consulta de datos por máquina](docs/images/08-datos.png)
![Consulta de datos día × máquina](docs/images/09-datos-matriz.png)

Rango con atajos (hoy, 7 días, 30 días), selección de máquinas y tres vistas: por máquina, por
día y día × máquina. El resumen del rango, la tabla con semáforo y la gráfica salen de los mismos
datos que el CSV y el Excel. El Excel trae portada, indicadores, tablas con semáforo y una hoja
que explica el cálculo.

### Producción

![Órdenes y corridas de inyección](docs/images/10-produccion.png)

Órdenes de producción y corridas por máquina: al abrir una corrida se congelan producto, molde,
resina y cavidades, y desde ahí sale el estándar por pieza que usa el OEE. La trazabilidad muestra
los lotes de resina consumidos y el personal asignado.

### Configuración

![Catálogos de inyección](docs/images/11-configuracion-catalogos.png)

Todo lo que se configura una vez: líneas, productos, moldes, resinas, recetas y lotes; turnos;
personal y puestos; reglas de alerta; ajustes de la planta. Solo el propietario o un supervisor
editan; el operador consulta.

### Notificaciones y seguimiento

![Campana con las notificaciones recientes](docs/images/12-notificaciones.png)

Las reglas de alerta (máquina con falla más de N segundos, sin conexión, OEE bajo el umbral)
generan notificaciones reales que llegan por WebSocket y se leen desde la campana sin cambiar de
pantalla; por correo si la persona no está conectada. *Seguimiento* lista las máquinas favoritas.

### Histórico de telemetría

![Histórico de variables de proceso](docs/images/13-historico-telemetria.png)

Variables de proceso por rango (1 h, 8 h, 24 h, 7 días o fechas), con promedio, mínimo y máximo
por intervalo, calidad del dato y la corrida a la que pertenece cada muestra.

### Móvil

![Tablero público en un teléfono](docs/images/14-movil-tablero-publico.png)

Toda la aplicación es responsive; en el teléfono la zona privada usa una barra de navegación
inferior.

---

## 4. Arquitectura general

```
                 navegador (es / en, responsive)
                            │ HTTPS
                            ▼
               Cloud Run · gateway Caddy (URL corta, redirecciones, cabeceras)
                            │ HTTPS hacia el origen
                            ▼
   ┌──────────────────────── VM de Google Cloud (Debian + Docker Compose) ─────────────────────┐
   │  Caddy ──► /api, /ws ──► API FastAPI ──► PostgreSQL 16                                     │
   │        └─► resto   ──► Frontend Next.js (SSR)        ▲          ▲                           │
   │                                                      │          │                           │
   │  Colector ──── Modbus TCP ───► Simulador (8 máquinas) │   Redis (snapshots, pub/sub)        │
   │     └── minutos, eventos, telemetría, alertas ───────┘          │                           │
   │  Mailpit (correo interno de la demo)  ◄── notificaciones ───────┘                           │
   └────────────────────────────────────────────────────────────────────────────────────────────┘
```

Tres procesos del backend comparten modelos y servicios: la **API** (REST + WebSocket), el
**colector** (lee Modbus cada segundo, persiste y evalúa alertas) y el **simulador** (hace de las
máquinas). El frontend es un servidor Next.js que renderiza la zona pública en servidor y consume
la API desde el navegador con un WebSocket por sesión. Todo corre en contenedores definidos en
Compose, con una capa extra de archivos para la demo y para la entrada por Cloud Run.

---

## 5. Arquitectura por partes

### 4.1 Servidor e infraestructura

| Pieza | Qué hace |
|---|---|
| VM `e2-medium` en GCP (Debian, Docker Engine, Compose) | Aloja todos los contenedores; IP fija; acceso por SSH mediante IAP, sin puertos abiertos salvo Caddy. |
| Caddy en la VM | TLS automático para el origen, proxy a API y frontend, filtra tokens y cookies de los registros. |
| Cloud Run `oee-live` | Entrada HTTPS con URL corta `oee-live-keepcoding.cloud.run`; redirige las direcciones anteriores con 308 y fija cabeceras canónicas. |
| Releases inmutables | Un archivo `oee-release.tar.gz` con manifiesto SHA-256 por versión; en la VM cada release vive en `/opt/oee-live/releases/<fecha>`; se despliega con Compose y se conserva la anterior para revertir. |
| Respaldos | `pg_dump` verificado antes de cada despliegue, en `/opt/oee-live/backups`. |
| Secretos | Un único `.env.demo` con permisos de root 0600; nunca en el repositorio ni en los registros. |

Archivos: `docker-compose.prod.yml` (base), `docker-compose.demo.yml` (demo: Mailpit, límites de
log), `docker-compose.cloud-run.yml` (URLs públicas del gateway), `Caddyfile*`, `scripts/gcp/`
(aprovisionamiento, empaquetado, despliegue y respaldo) y `docs/gcp-deployment.md` (guía completa).

### 4.2 Base de datos

PostgreSQL 16 con migraciones Alembic (`backend/alembic`). Las tablas principales:

| Grupo | Tablas | Notas |
|---|---|---|
| Cuentas y acceso | `users`, `refresh_tokens`, `password_resets`, `plant_members` | Roles por planta: owner, supervisor, viewer. Refresh rotatorio con familia revocable. |
| Planta | `plants`, `shifts`, `machines`, `downtime_reasons` | Zona horaria IANA por planta; turnos de 8 h; foto de máquina en tres tamaños WebP. |
| Captura | `production_minutes`, `production_samples`, `machine_events`, `machine_checkpoints`, `telemetry_samples` | Deltas por minuto, un solo evento abierto por máquina (índice único parcial), contadores absolutos para sobrevivir caídas del colector, variables de proceso con calidad del dato. |
| Inyección | `production_lines`, `products`, `molds`, `resins`, `resin_lots`, `recipes`, `orders`, `production_runs`, `run_materials`, `run_assignments`, `line_downtimes` | Una corrida congela producto, molde, resina y cavidades; el OEE pondera cada minuto con el estándar de su corrida. |
| Alertas | `alert_rules`, `notifications`, `watchlist` | Reglas por máquina o por planta; deduplicación por destinatario; entrega en vivo o por correo. |

Todo se guarda en UTC; los cortes por día y por turno se calculan en la zona de la planta.

### 4.3 Backend (FastAPI, Python 3.12)

- **API REST** `/api/v1` con OpenAPI: auth (registro, login, refresh por cookie `HttpOnly`,
  recuperación de contraseña, perfil, baja), plantas y miembros, máquinas con foto, turnos,
  eventos y clasificación, OEE por hora/turno/día, resumen de planta, CSV, catálogos de
  inyección, órdenes y corridas con trazabilidad, paros de línea, variables y telemetría,
  tablero y plano, alertas, notificaciones y seguimiento.
- **WebSocket** privado por sesión (snapshots y notificaciones) y público por planta.
- **Colector**: lee cada máquina por Modbus TCP cada segundo, convierte disparos en piezas según
  las cavidades activas, persiste minutos y eventos, mantiene snapshots en Redis y evalúa las
  reglas de alerta.
- **Cálculo de OEE** con reglas explícitas: excluye tiempo fuera de turno, une turnos solapados,
  limita el rendimiento a 100 %, devuelve `null` ante divisor cero y agrega la planta con
  acumulados, nunca promediando porcentajes.
- **Pruebas**: 227 pruebas automatizadas (unitarias y de API) más variantes opcionales contra
  PostgreSQL real.

Carpeta `backend/`: `app/api` (rutas), `app/services` (reglas de negocio), `app/models`
(SQLAlchemy), `app/schemas` (DTO), `app/collector`, `alembic/`, `tests/`.

### 4.4 Simulador Modbus

`simulator/` expone un servidor Modbus TCP con ocho máquinas y perfiles de producción, falla,
paro y rechazo reproducibles por semilla, más un pequeño control HTTP para forzar estados. Permite
probar el sistema completo sin una planta real y es lo que alimenta la demo.

### 4.5 Frontend (Next.js 16, TypeScript estricto)

- **Zona pública** con SEO: portada (acceso, instrucciones y guía), tablero de planta en vivo y
  detalle de máquina con URL amigable, metadatos, sitemap, hreflang y botones para compartir.
- **Zona privada** `/app`: mis plantas, tablero (plano o tarjetas), máquinas, producción, paros,
  datos, configuración, seguimiento, notificaciones y perfil.
- **Capas**: `lib/api` (cliente tipado del contrato, renovación de token única y concurrente),
  `lib/realtime` (WebSocket con reconexión, escritura directa en la caché), `lib/` (formato,
  zona horaria, validación zod, CSV, agregados, Excel), `components/` por módulo, `mocks/` (MSW
  con un motor de simulación propio para desarrollar sin backend).
- **Herramientas**: next-intl (es/en), TanStack Query, React Hook Form + zod, Tailwind 4,
  Recharts, exceljs (Excel con formato generado en el navegador), MSW, Vitest (68 pruebas) y un
  recorrido Playwright de 35 pasos.
- **Diseño**: sala de control industrial, tema oscuro y claro, responsive hasta 390 px,
  accesible (foco visible, diálogos nativos, nombres accesibles, navegación por teclado).

Detalle en [frontend/README.md](frontend/README.md).

---

## 6. Cómo cubre los requisitos del bootcamp

| Requisito | En OEE Live |
|---|---|
| Multi-idioma | es / en en toda la interfaz; correos en el idioma del usuario; el API devuelve códigos, no textos |
| Zona pública con SEO y responsive | Portada, tablero público, detalle de máquina con URL amigable, SSR, metadatos, sitemap, hreflang |
| Zona privada con login | Plantas, máquinas, turnos, personal, alertas, producción, paros, datos |
| API REST | FastAPI `/api/v1` con OpenAPI |
| Registro, login, logout, recuperar contraseña, editar datos, baja | Completo; la baja borra la información del usuario y sus plantas si era el único propietario |
| Usuario o email únicos | Validación en backend y comprobación en el formulario |
| CRUD con imagen y versiones responsive | Máquinas con foto en 320 / 768 / 1280 px (WebP) |
| Listados con límite, orden y paginación | Máquinas, eventos, notificaciones, seguimiento, plantas públicas |
| Buscador con filtros | Máquinas por nombre, estado y marca; eventos y paros por rango, estado y máquina |
| Favoritos | Lista de seguimiento de máquinas |
| Notificaciones en tiempo real o por email | Máquina caída, sin conexión u OEE bajo el umbral: toast y campana por WebSocket, correo si no está conectado |
| Compartir en redes | X, Facebook, LinkedIn y WhatsApp desde el detalle público |
| Roles | Anónimo, propietario, supervisor, operador (por planta) |
| Estados de interfaz | Cargando, ideal, error con reintento, vacío y en progreso en cada componente de datos |
| Desplegado en internet | Google Cloud: VM con Docker Compose y Caddy, entrada HTTPS por Cloud Run |
| Valor extra | Simulador Modbus, colector en tiempo real, clasificación de paros, corridas de inyección, Excel con formato |

---

## 7. Ejecutarlo en localhost

### Opción A · Todo con Docker (recomendada)

Requiere Docker Engine con Compose. Desde esta carpeta:

```sh
cp .env.example .env
docker compose up --build -d
docker compose exec api python -m app.seed
```

Levanta PostgreSQL, Redis, Mailpit, API, simulador, colector y frontend, aplica migraciones y crea
la planta de demostración. Cuenta local: usuario `demo`, contraseña `Demo1234!`.

| Servicio | Dirección |
|---|---|
| Aplicación | http://localhost:3000/es |
| API y OpenAPI | http://localhost:8000/api/v1/docs |
| Buzón de correo de desarrollo | http://localhost:8025 |
| Control del simulador | http://localhost:8100/machines |

### Opción B · Solo el frontend, sin backend

Requiere Node 20.9+ y pnpm 12. Los mocks (MSW) traen tres plantas, once máquinas, siete días de
histórico y simulación en vivo.

```sh
cd frontend
pnpm install
pnpm dev
```

Abre http://localhost:3000/es. Usuarios de prueba: `demo` / `Demo1234!` (propietario),
`lmendez` / `Super1234` (supervisora) y `cruiz` / `Viewer1234` (operador).

### Opción C · Backend sin contenedores

Python 3.12 y uv, con PostgreSQL, Redis y un SMTP de desarrollo accesibles según `.env`:

```sh
cd backend
uv sync --python 3.12
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
uv run python -m app.collector      # en otra terminal
```

El simulador se arranca desde `simulator/` (ver su README). La referencia técnica completa de
configuración, variables y decisiones está en [docs/README-tecnico.md](docs/README-tecnico.md).

---

## 8. Qué reforcé con este bootcamp

Trabajo en la creación de sistemas para la industria automotriz: un MES y un ERP de planta que
capturan datos de máquinas de inyección y ensamble en tiempo real, trazabilidad por etiqueta y
tableros de producción. Llegué al bootcamp con ese contexto y con formación previa en datos e
inteligencia artificial. Lo que me dejó, aplicado en este proyecto:

- **TDD y pruebas como parte del diseño.** Las reglas del OEE, el agregado de reportes, el
  parseo del CSV, el libro de Excel y el cliente de API nacieron con su prueba. 227 pruebas en el
  backend y 68 en el frontend, más un recorrido de extremo a extremo que ejecuto antes de cada
  entrega.
- **Arquitectura hexagonal, en la práctica.** Dominio y servicios separados de rutas y modelos en el
  backend; en el frontend, un cliente de API tipado y una capa de tiempo real desacoplados de los
  componentes, con mocks que implementan el mismo contrato para desarrollar sin servidor.
- **React avanzado.** App Router con renderizado en servidor y componentes cliente, caché y
  sincronización con TanStack Query, escritura de snapshots de WebSocket en la caché sin volver a
  pedir, formularios con React Hook Form y zod, internacionalización, accesibilidad y estados de
  interfaz explícitos.
- **Backend.** API REST con contrato OpenAPI, autenticación con JWT y refresh rotatorio, roles por
  recurso, WebSocket, procesos en segundo plano (colector) y cálculo con reglas de negocio
  verificables.
- **Servidores y despliegue.** Contenedores con Docker Compose, proxy con TLS, releases
  inmutables con manifiesto, respaldos, una VM en Google Cloud y Cloud Run como entrada HTTPS;
  y la costumbre de verificar en producción con un recorrido automatizado antes de dar algo por
  entregado.
- **Trabajar sobre un contrato.** El frontend y el backend se construyeron en paralelo contra una
  especificación escrita (`docs/especificacion.md`), con mensajes de integración numerados y
  decisiones registradas. Eso es exactamente lo que necesito en la industria, donde el PLC, el
  colector, la base y la pantalla los hacen equipos distintos.

---

## 9. Estructura de la carpeta

```
09_proyecto-final/
  backend/        API FastAPI, colector, modelos, migraciones y pruebas
  frontend/       Next.js 16: zona pública, zona privada, mocks y pruebas
  simulator/      Simulador Modbus TCP de ocho máquinas
  scripts/gcp/    Aprovisionamiento de la VM, empaquetado de releases, despliegue y respaldo
  docs/           especificacion.md (contrato), gcp-deployment.md (servidor), README-tecnico.md, images/ (capturas)
  docker-compose*.yml, Caddyfile*, .env.example
```

---

## 10. Estado

Entregado el 22 de octubre de 2026 y desplegado en https://oee-live-keepcoding.cloud.run, con
los datos de la planta de demostración generándose en vivo. La demo permanece una semana; el
código de esta carpeta levanta el sistema completo en cualquier equipo con Docker.
