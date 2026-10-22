# Simulador Modbus

Desde esta carpeta, instala `requirements.txt` con Python 3.12 y ejecuta
`python -m oee_simulator`. HTTP escucha en `8100` y Modbus TCP en `5020`.
En Compose ambos servidores se ejecutan dentro del servicio `simulator`.

En el entorno local de integración el simulador escucha en `127.0.0.1:5020`.
Usa esa dirección en el campo host de la máquina y al probar la conexión:
`localhost` puede resolverse a `::1`, donde este proceso IPv4 no escucha.
Dentro de Compose el host sigue siendo `simulator`.

`machines.yaml` contiene ocho inyectoras de demostración, con 1, 2 o 4 cavidades
activas por perfil: las unidades 1 a 8 usan respectivamente 4, 2, 1, 4, 2, 1, 4 y 2.
Los registros holding
`0..8` siguen `docs/especificacion.md`; cada equipo tiene su propio `unit_id`.
Se fija `pymodbus==3.11.4`: el cliente utiliza `device_id`, no el antiguo `slave`.

Control HTTP (exclusivo de la red de demostración, sin autenticación):

- `GET /health`: verifica el servidor Modbus y el ciclo de simulación.
- `GET /machines`: `{items: [...]}` con registros decodificados y conexión por equipo.
- `POST /machines/1/fault`, JSON `{"alarm_code":3,"duration_s":120}`.
- `POST /machines/1/disconnect`, JSON `{"duration_s":20}`.
- `POST /machines/1/reset-counters` sin cuerpo.

El control de desconexión congela los registros y el heartbeat visibles por TCP;
la máquina sigue produciendo internamente y publica sus valores al recuperarse.
El colector detecta el heartbeat estancado a los cinco segundos. Un fallo HTTP
simulado coloca el equipo en DOWN y se recupera al vencer el tiempo especificado.
Los ciclos incorporan variación aleatoria, scrap, averías, reparaciones, microparos
y periodos IDLE. Los contadores uint32 y heartbeat uint16 regresan a cero al superar
su límite. El reset afecta únicamente a los contadores de producción.

## Mapa de inyección de demostración

`machines.yaml` es la fuente del mapa `injection-demo-v1`, de las unidades y de
los perfiles. **Las direcciones y los valores son simulados; no son el mapa de
un PLC del MES.** La referencia MES usa los nombres `cycle_time_s`,
`filling_time_s`, `dose_time_s`, `min_cushion_position`,
`vp_switchover_position` y `peak_injection_pressure`. En esa referencia solo
los tres tiempos declaran segundos; las posiciones y la presión no declaran
unidad. Aquí se eligen explícitamente mm y bar para la demostración. Las demás
variables de la tabla son también convenciones de esta demo.

| Código | Dirección holding | Tipo | Unidad de la demo |
| --- | ---: | --- | --- |
| `cycle_time_s` | 6 | uint16, escala 0.1 | s por disparo, mapa base |
| `filling_time_s` | 9–10 | float32 | s |
| `dose_time_s` | 11–12 | float32 | s |
| `min_cushion_position` | 13–14 | float32 | mm, elegida para demo |
| `vp_switchover_position` | 15–16 | float32 | mm, elegida para demo |
| `peak_injection_pressure` | 17–18 | float32 | bar, elegida para demo |
| `cooling_time_s` | 19–20 | float32 | s |
| `melt_temperature_c` | 21–22 | float32 | °C |
| `mold_temperature_c` | 23–24 | float32 | °C |
| `holding_pressure` | 25–26 | float32 | bar |
| `clamp_force` | 27–28 | float32 | kN |
| `shot_count` | 29–30 | uint32 | disparos |
| `active_cavities` | 31 | uint16 | cantidad |

El orden de palabras y bytes es big-endian; los opcionales usan escala 1 y
offset 0. Los registros 0–8 conservan el contrato original. `good_count` y
`reject_count` son **piezas**: cada disparo produce tantas piezas como cavidades
activas tenga el perfil, repartidas entre buenas y rechazo. El colector no vuelve
a multiplicarlas por cavidades.
El ciclo ideal de la receta y el registro 8 expresan segundos por disparo;
el estándar por pieza de una corrida es `ideal_cycle_s / active_cavities`.
`shot_count` permite distinguir disparos de piezas y se reinicia junto a los
contadores de producción.

Las variables de proceso se actualizan al completar cada disparo, con variación
aleatoria. Antes del primero, los float32 contienen NaN: la API del simulador
los muestra como null y el colector los registra con `quality: bad`, sin inventar
ceros. Las lecturas posteriores son observaciones por polling del último
disparo; no representan un archivo con exactamente una fila por disparo.

El seed del backend crea dos líneas, ocho productos, moldes, recetas, órdenes
y corridas, además de resina, lote y los 96 mapeos de variables. Las corridas
congelan cavidades, ciclo, peso, línea y contexto de producto. Los mapeos guardan
`map_version: injection-demo-v1`, también copiado en cada medición persistida;
`MachineTelemetry.source` es `modbus`, que identifica el transporte.

Desde `backend`, `python -m app.seed --days 0 --dry-run` comprueba la carga y
revierte la transacción. `python -m app.seed --days 0` añade únicamente la
configuración. `--days 7` conserva el historial de demostración anterior de una
pieza por disparo, con el ciclo de máquina anterior; no retroactiva las nuevas
cavidades sobre ese historial. Las nuevas corridas empiezan al ejecutar el seed.
No se inventa telemetría histórica de proceso.

Repetir el seed conserva IDs, slugs, hosts, estándares de máquina, mapas editados,
historial, corridas cerradas y nombres personalizados. Solo transforma los nombres
exactos de máquinas legacy del seed en nombres de inyectora. No reactiva catálogos
deshabilitados ni ocupa una máquina o molde con corrida abierta. Los cambios de
datos y los reinicios del entorno activo se coordinan aparte; estas instrucciones
no ejecutan automáticamente el seed al arrancar el colector.

Variables opcionales: `SIMULATOR_CONFIG`, `SIMULATOR_SEED` (semilla reproducible),
`SIMULATOR_HTTP_HOST`, `SIMULATOR_HTTP_PORT`, `SIMULATOR_MODBUS_HOST`,
`SIMULATOR_MODBUS_PORT`. No publicar el puerto de control en producción.

## Criterios del colector

El backend ejecuta `python -m app.collector` por separado: polling de un segundo,
recarga de máquinas activas cada 30 segundos y publicación cada dos segundos.
Comparte y serializa conexiones por host/puerto, con reintentos exponenciales hasta
30 segundos. Un equipo sin respuesta no impide leer otros unit IDs del gateway.
Un advisory lock PostgreSQL impide ejecutar dos colectores sobre la misma base.

Los mapeos activos se recargan cada 30 segundos. Las variables opcionales
contiguas se leen en bloques de hasta 125 registros, sin cruzar huecos no
configurados; un bloque fallido produce valores null/bad y no invalida la lectura
base de contadores. Su presupuesto total de dos segundos libera el lock incluso
si un dispositivo no responde. Un heartbeat congelado marca los valores recibidos
como stale. Las mediciones incluyen unidad, valor raw y copia del mapeo utilizado.
El historial `machine_telemetry` se confirma junto con los contadores y se vincula
a la corrida vigente en `sampled_at`; el buffer sobrevive a un rollback SQL y
se vacía solo tras el commit, aunque Redis falle después.

La primera lectura establece la línea base, sin convertir los contadores absolutos
en producción nueva. Reconexiones dentro del mismo proceso conservan esa base;
si un contador baja, el delta es el valor actual (también para wrap). Cada delta
positivo se guarda en `production_samples` con el instante de la lectura y se suma
al minuto UTC de ese instante. El tiempo del estado anterior se reparte en todos
los minutos atravesados, incluso cuando una lectura cruza el límite del minuto.
Después de tres lecturas fallidas, o cinco segundos sin cambio de heartbeat,
se abre un evento OFFLINE y se conservan los últimos contadores visibles.

Los deltas, eventos y `machine_checkpoints` se escriben en lotes dentro de una misma
transacción; los buffers no se descartan antes del commit. El checkpoint SQL conserva
los contadores absolutos y `accounted_at`, el último instante contabilizado. OEE limita
los eventos abiertos a ese instante, evitando aumentar RUNNING si el colector cae.
Redis contiene el snapshot del contrato en
`machine:{id}:snapshot` y un checkpoint interno separado en
`machine:{id}:collector` después de cada commit. Al reiniciar el proceso se recuperan
los últimos valores del checkpoint SQL y se cierra el evento previo en su instante
conocido, registrando OFFLINE durante el intervalo sin supervisión. Se establece una
línea base nueva de contadores, sin inventar producción durante ese intervalo.
El checkpoint SQL permite hacerlo incluso si también se perdió Redis. En equipos
antiguos sin checkpoint aún disponible, solo se conserva el evento conocido hasta
una nueva observación. Si una máquina
cambia de host/puerto/unit ID también se reinicia su línea base. Una parada ordenada
del colector deja un evento OFFLINE persistido. La pérdida abrupta del proceso se
detecta operacionalmente porque `collector:heartbeat` vence a los diez segundos.

Las pruebas en `tests/test_simulator.py` levantan un servidor TCP real en un puerto
efímero, consultan los ocho unit IDs y ejercitan los controles HTTP.

## Pruebas de integración opcionales

`tests/smoke_collector.py` ejecuta el colector completo contra PostgreSQL y Modbus
TCP reales; comprueba la alerta DOWN esperando más de 30 segundos, reset de
contadores, OFFLINE por heartbeat y recuperación. `tests/smoke_realtime.py` levanta
la API con Uvicorn y verifica HTTP, WebSockets públicos/privados, entrega de
notificaciones, expiración JWT, retirada de permisos durante una conexión abierta
y cierre 1013 de ambos WebSockets cuando desaparece el heartbeat del colector.

Se ejecutan con el entorno Python del backend y requieren
`COLLECTOR_SMOKE_DATABASE_URL` apuntando a una base PostgreSQL local **vacía y
desechable**, llamada `oee_collector_test` o con un sufijo de letras minúsculas,
dígitos y guiones bajos. Rechazan servidores externos y bases con tablas, vistas o
secuencias existentes. Un bloqueo exclusivo impide ejecutar ambos simultáneamente
en la misma base. Los scripts crean y eliminan exclusivamente sus tablas, también
si una comprobación falla. No crean ni eliminan la base de datos o el servidor.
Ambos usan `fakeredis` por TCP, identificado expresamente
como un emulador: estas pruebas no sustituyen la verificación contra Redis 7 real
en Compose. En Windows el harness habilita sockets no bloqueantes en el emulador
para que su pub/sub funcione como en Linux. Ningún código de producción cambia
por esa adaptación.

Los procesos de prueba abren todos sus sockets en `127.0.0.1` y puertos efímeros;
no utilizan los puertos públicos 5020/8100/8000/6379. Uvicorn, el simulador y el
emulador viven dentro del proceso de prueba, y sus contextos cierran los sockets,
clientes, conexiones SQL y archivos temporales al terminar. No se buscan ni se
detienen procesos externos. El emulador no se instala como servicio ni se utiliza
en Compose o en el producto.

Ejemplo PowerShell desde la raíz del proyecto, con el PostgreSQL local aislado
en `127.0.0.1:55432` y usuario `oee`. Se verificó con PostgreSQL **17**; Compose
mantiene PostgreSQL **16**, cuya ejecución integrada sigue pendiente cuando no
hay Docker disponible:

```powershell
Set-Location backend
uv sync
.venv\Scripts\python.exe -m pytest tests/test_counters.py tests/test_collector.py ../simulator/tests/test_simulator.py -q

$pgBin = 'C:\Program Files\PostgreSQL\17\bin'
$smokeDb = 'oee_collector_test_' + (Get-Date -Format 'yyyyMMddHHmmss')
& "$pgBin\createdb.exe" -h 127.0.0.1 -p 55432 -U oee $smokeDb
if ($LASTEXITCODE -ne 0) { throw 'No se creó la base temporal; no continuar.' }
$previousSmokeUrl = $env:COLLECTOR_SMOKE_DATABASE_URL
try {
    $env:COLLECTOR_SMOKE_DATABASE_URL = "postgresql+asyncpg://oee@127.0.0.1:55432/$smokeDb"
    .venv\Scripts\python.exe ../simulator/tests/smoke_collector.py
    if ($LASTEXITCODE -ne 0) { throw 'Falló la prueba del colector.' }
    .venv\Scripts\python.exe ../simulator/tests/smoke_realtime.py
    if ($LASTEXITCODE -ne 0) { throw 'Falló la prueba WebSocket.' }
} finally {
    $env:COLLECTOR_SMOKE_DATABASE_URL = $previousSmokeUrl
    & "$pgBin\dropdb.exe" -h 127.0.0.1 -p 55432 -U oee $smokeDb
}
```

La prueba del colector tarda aproximadamente un minuto porque verifica una alerta
de 30 segundos con tiempo real. Una terminación forzada del intérprete o caída de
PostgreSQL puede impedir la limpieza automática; la base creada para la prueba
continúa siendo desechable y se elimina con el `dropdb` del bloque anterior.
