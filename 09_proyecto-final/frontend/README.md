# OEE Live · frontend

Interfaz web de OEE Live: zona pública con SEO (landing, tablero de planta en vivo y detalle de máquina) y zona privada `/app` para administrar plantas, máquinas, turnos, miembros, alertas y reportes. Next.js con App Router, TypeScript estricto, renderizado en servidor para lo público y un WebSocket por sesión para lo privado.

## Levantarlo

Requiere Node 20.9 o superior y pnpm 12.

```bash
cd frontend
pnpm install
pnpm dev
```

`pnpm dev` arranca en `http://localhost:3000` con `.env.development`, que activa los mocks: no hace falta backend. Para ir contra el API real, crea `.env.local` a partir de `.env.example` y pon `NEXT_PUBLIC_API_MOCKING=false`.

Usuarios de prueba con mocks: `demo` / `Demo1234!` (propietario), `lmendez` / `Super1234` (supervisora) y `cruiz` / `Viewer1234` (lector). Los datos simulados viven en memoria de la página: recargar vuelve al estado inicial.

## Variables de entorno

| Variable                  | Uso                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`     | URL del API tal como la ve el navegador, con el prefijo `/api/v1`.                                                                |
| `NEXT_PUBLIC_WS_URL`      | URL del WebSocket (`/ws`). El público cuelga de `/ws/public/{slug}`.                                                              |
| `NEXT_PUBLIC_SITE_URL`    | Origen público del frontend, para metadatos, sitemap y hreflang.                                                                  |
| `NEXT_PUBLIC_API_MOCKING` | `true` activa MSW en navegador y en el servidor de Next, más el WebSocket simulado.                                               |
| `API_URL_INTERNAL`        | URL del API para las consultas que hace el servidor de Next (SSR y sitemap). Dentro de Compose apunta a `http://api:8000/api/v1`. |

Las variables `NEXT_PUBLIC_*` se incrustan al compilar: en la imagen de Docker van como argumentos de build, no como variables de ejecución.

## Scripts

| Script                      | Qué hace                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                  | Servidor de desarrollo con Turbopack.                                                                                             |
| `pnpm build` / `pnpm start` | Build de producción (salida `standalone`) y servidor.                                                                             |
| `pnpm lint`                 | ESLint con las reglas de Next, TanStack Query y Prettier.                                                                         |
| `pnpm format`               | Prettier sobre todo el proyecto.                                                                                                  |
| `pnpm typecheck`            | Genera los tipos de rutas de Next y corre `tsc`.                                                                                  |
| `pnpm test`                 | Vitest: formateo, zona horaria, cliente de API, esquemas zod, reductor de snapshots, CSV, agregados de reportes y libro de Excel. |

## Imagen de Docker

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://midominio/api/v1 \
  --build-arg NEXT_PUBLIC_WS_URL=wss://midominio/ws \
  --build-arg NEXT_PUBLIC_SITE_URL=https://midominio \
  -t oee-live-frontend .
docker run -p 3000:3000 -e API_URL_INTERNAL=http://api:8000/api/v1 oee-live-frontend
```

La imagen es multietapa: instala con pnpm, compila con los argumentos públicos y sirve la salida `standalone` con un usuario sin privilegios. El `docker-compose` de la raíz la construye con esos mismos argumentos.

## Rutas

| Ruta                                                                                            | Qué muestra                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/[locale]`                                                                                     | Portada: acceso, cómo entrar a la demo (usuario de consulta), guía de uso en cuatro pasos y listado paginado de plantas públicas.                                                                                      |
| `/[locale]/plants/[plantSlug]`                                                                  | Tablero público en vivo (SSR y WebSocket público).                                                                                                                                                                     |
| `/[locale]/plants/[plantSlug]/[machineSlug]`                                                    | Detalle público: OEE de hoy, tendencia de 12 h, foto y botones para compartir.                                                                                                                                         |
| `/[locale]/login`, `/register`, `/forgot-password`, `/reset-password`                           | Acceso y recuperación de cuenta.                                                                                                                                                                                       |
| `/[locale]/app`                                                                                 | Mis plantas con OEE de hoy.                                                                                                                                                                                            |
| `/[locale]/app/plants/[id]`                                                                     | Tablero en vivo con vista de planta (líneas, siluetas por estado, ticker de paros, pantalla completa) o tarjetas.                                                                                                      |
| `/[locale]/app/plants/[id]/machines`, `/shifts`, `/members`, `/alerts`, `/reports`, `/settings` | Máquinas, turnos, personal (cuentas y empleados), alertas, consulta de datos (pestaña Datos: rango, máquinas, vista por día, por máquina o día × máquina, descarga a Excel y CSV, ayuda del cálculo de OEE) y ajustes. |
| `/[locale]/app/plants/[id]/production`                                                          | Órdenes y corridas de inyección con trazabilidad (materiales por lote y personal por puesto).                                                                                                                          |
| `/[locale]/app/plants/[id]/downtimes`                                                           | Paros de máquina de toda la planta (falla e inactividad con motivo, comentario y quién clasificó) y paros de línea abiertos e histórico.                                                                               |
| `/[locale]/app/plants/[id]/catalogs`                                                            | Líneas, productos, moldes, resinas, recetas y lotes de resina.                                                                                                                                                         |
| `/[locale]/app/plants/[id]/machines/[machineId]`                                                | Snapshot en vivo, corrida vigente, variables de proceso, tendencia de OEE, línea de tiempo de 8 h y eventos.                                                                                                           |
| `/[locale]/app/plants/[id]/machines/[machineId]/history`, `/variables`                          | Histórico de telemetría por variable, rango y corrida; configuración de variables Modbus.                                                                                                                              |
| `/[locale]/app/watchlist`, `/notifications`, `/profile`                                         | Seguimiento, notificaciones y perfil.                                                                                                                                                                                  |

Las pestañas de trabajo son Tablero, Máquinas, Producción, Paros y Datos; todo lo que se configura una vez (catálogos, turnos, personal, alertas y la planta) vive bajo Configuración. Las acciones se muestran según el puesto en la planta: el propietario administra, el supervisor edita máquinas, catálogos, corridas, paros, turnos y alertas, el operador solo consulta.

## Estructura

```
src/
  app/[locale]/        rutas con prefijo de idioma (es por omisión)
    (public)/          landing, tableros públicos, login y registro
    app/               zona privada
  components/          layout, estados de datos, formularios, gráficas, paneles por módulo
    catalogs/          tabla y diálogos genéricos de catálogo
    production/        órdenes, corridas y trazabilidad
    downtimes/         paros de línea
    plants/            tablero, vista de planta y silueta de máquina
    machines/          detalle, corrida vigente, telemetría, histórico y variables
  hooks/               debounce, reloj compartido, disponibilidad, cierre de sesión
  i18n/                routing, navegación y carga de mensajes
  lib/api/             cliente fetch, tipos del contrato y funciones por recurso
  lib/auth/            sesión en memoria y cookie de marca
  lib/realtime/        cliente WebSocket, reductores de snapshots y escritura en caché
  lib/                 formato, zona horaria, validación zod, CSV, agregados de reportes
  mocks/               datos simulados, handlers de MSW, cálculo de OEE y WebSocket simulado
                       (injection-data.ts, injection.ts y board.ts cubren catálogos, corridas,
                       paros, telemetría, tablero y series)
  proxy.ts             idioma y protección de /app
messages/              es.json y en.json
public/machines/       silueta de inyectora teñida por estado; public/plant-bg.jpg, foto de la nave
```

## Decisiones

- **Sesión.** El access token vive solo en memoria. El refresh es una cookie httpOnly del backend que el navegador nunca expone. Como el proxy de Next no puede ver esa cookie, el frontend escribe una marca `oee_session` sin datos para decidir si `/app` redirige a login; la sesión real se recupera con un refresh silencioso al cargar, y solo si existe la marca.
- **Cliente de API.** Un solo `fetch` tipado: agrega el Bearer, manda credenciales, traduce `{error: {code, field}}` a `ApiError` y ante un 401 renueva el token una sola vez y reintenta. Varias peticiones concurrentes comparten la misma renovación. Los errores con `field` caen en el campo del formulario; el resto se traduce con next-intl.
- **Tiempo real.** Un `RealtimeClient` por sesión con reconexión exponencial y jitter, suscripción por planta contada por referencias y manejo de los cierres 4401 (renovar y reconectar), 4403 (soltar la planta) y 4404. Cada `machine.snapshot` se escribe en la caché de TanStack Query (máquina, listas de la planta, seguimiento) sin refetch; las notificaciones suben el contador de la campana y abren un toast con "Ver máquina". Al reconectar se invalida el estado REST.
- **Mocks.** MSW cubre todos los endpoints de la especificación con una base en memoria: tres plantas, once máquinas, siete días de minutos de producción generados con perfiles de falla, paro y rechazo, y un motor que sigue simulando en vivo. En el navegador corre como service worker; en el servidor de Next los handlers se resuelven directo con `getResponse`, sin interceptar la red. El WebSocket simulado emite snapshots cada 2 s y alguna notificación.
- **Zona horaria.** Las fechas llegan en UTC y se muestran en la zona de cada planta con `Intl`. Los cortes por día y por turno se calculan con la zona IANA de la planta, no con un desfase fijo.
- **Reportes.** La pantalla Datos pide el resumen diario de OEE de la planta por cada día local del rango (en paralelo, con caché infinita para días cerrados) y arma con esas filas las tres vistas, la gráfica, el CSV (mismas columnas que el del servidor, generado en el navegador) y el Excel. El CSV del servidor `/reports/oee.csv` sigue en el API, pero recalcula cada máquina y día y tarda decenas de segundos, por eso ya no lo espera la pantalla. Los agregados por día y por máquina usan las reglas del resumen de planta (sumas de tiempos y piezas, rendimiento por tiempo ideal). La columna `ideal_seconds` del CSV manda cuando existe; si el archivo no la trae se usa el estándar base de cada máquina en s/pieza, y una celda vacía deja el rendimiento y el OEE sin valor en vez de inventarlos. La ayuda "Cómo se calcula este OEE" enseña los operandos del rango consultado. La descarga a Excel se arma en el navegador con `exceljs` (su paquete de navegador, cargado solo al pulsar el botón): hojas de resumen, por día, día × máquina, detalle y cálculo, con porcentajes, duraciones h:mm y semáforo por celda; el filtro de máquinas de la pantalla es el mismo del archivo.
- **Inyección.** Al abrir una corrida se congelan producto, molde, resina, línea y cavidades; la interfaz siempre lee las cavidades de ese contexto. Las unidades van explícitas: el ciclo de máquina es por disparo, el estándar de OEE es por pieza (ciclo ideal ÷ cavidades activas) y los contadores ya están en piezas. Un paro de línea es una capa informativa que no cambia el estado Modbus. Las series de telemetría se piden agregadas al servidor (promedio, mínimo y máximo por intervalo con conteos de calidad), los huecos no se interpolan y cada variante de mapeo se dibuja por separado.
- **Gráficas.** Una serie por gráfica, línea de 2 px con marcadores, cuadrícula en línea fina, tooltip con todos los valores del punto y vista de tabla equivalente. La línea de tiempo de estados usa los mismos colores de estado del resto del producto, siempre acompañados de texto.
- **Estados de interfaz.** `QueryState` conecta cada consulta con su skeleton, su error traducido con reintento y su estado vacío; `PendingButton` deshabilita y señala el envío. Las confirmaciones usan `<dialog>` nativo: foco atrapado, Escape y fondo bloqueado sin librerías.
- **Diseño.** Sala de control: fondo azul-negro con la foto de la nave bajo un velo oscuro, paneles de vidrio con borde fino y sombra, rótulos en versalitas pesadas, cifras monoespaciadas con `tabular-nums`, chips y brillos por estado (la falla pulsa), silueta de inyectora teñida con el color de estado en el plano y como marcador de máquina sin foto (las tarjetas solo llevan foto real), gauge radial de OEE y barras de A, P y Q con el mismo semáforo (verde desde 90 %, ámbar de 70 a 90, rojo por debajo). Tema claro equivalente, foco visible y tablas que pasan a lista en móvil. Cada cuenta es una persona de la planta: los roles se presentan como puestos (propietario, supervisor, operador) y la pestaña de cuentas se llama Personal. Las imágenes de `public/` son activos propios del responsable del proyecto.
- **Portada y demo.** La portada es la puerta de entrada: formulario de acceso, cómo entrar a la demo con la cuenta de consulta y guía de uso. El usuario mostrado sale de `NEXT_PUBLIC_DEMO_USERNAME` (por omisión `demo`) y la contraseña solo se muestra si el contenedor recibe `NEXT_PUBLIC_DEMO_PASSWORD`; ambas se leen en el servidor de Next al renderizar, no se incrustan en el build. La campana de la cabecera despliega las últimas notificaciones ahí mismo, con marcar leída y enlace a la máquina.
- **Correo en la demo.** La instalación de demostración captura el correo en un buzón interno (Mailpit) y no lo entrega a direcciones reales; la pantalla de recuperación de contraseña lo avisa. Con un proveedor SMTP configurado el aviso sobra, pero no estorba.
- **node_modules plano.** `pnpm-workspace.yaml` fija `nodeLinker: hoisted` para que la instalación funcione también en discos sin enlaces simbólicos.
