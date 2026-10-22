# Servidor de la demo en GCP

OEE Live está publicado en la dirección de Google
[https://oee-live-940610535384.us-central1.run.app](https://oee-live-940610535384.us-central1.run.app).
El 22 de octubre de 2026 se verificaron HTTPS, acceso, permisos, datos en vivo,
históricos y WebSocket público y privado contra esta dirección. Cloud Run actúa
como entrada HTTPS hacia la VM; PostgreSQL, los datos, las cuentas, el colector
y el simulador permanecen en ella. El hostname anterior
`oee-live.34.57.59.112.sslip.io` redirige al nuevo. No se ha comprado un dominio.

Comparte la dirección canónica indicada arriba. `gcloud` puede mostrar también
el alias generado `oee-live-ipb33l6tya-uc.a.run.app` en `status.url`; las URLs del
frontend y las sesiones se han configurado para el hostname con número de proyecto.

| Recurso | Configuración desplegada |
| --- | --- |
| Proyecto | `keepcoodingoee` (nombre visible: `KeepCoodingOEE`) |
| Región / zona | `us-central1` / `us-central1-a` |
| VM | `oee-demo`, `e2-medium` (4 GB RAM, CPU compartida) |
| Sistema / disco | Debian 12, 30 GB `pd-standard` |
| Swap | Archivo de 2 GB, si no existe swap |
| Red | VPC propia `oee-demo-network`, subred `oee-demo-subnet`, `10.72.0.0/24` |
| IP pública | `34.57.59.112`, IPv4 regional fija `oee-demo-ip` |
| Entrada web | TCP 80/443 y UDP 443, solo a la etiqueta `oee-demo` |
| Administración | TCP 22 exclusivamente desde IAP `35.235.240.0/20` |
| Identidad de la VM | OS Login; sin cuenta de servicio ni scopes de API |
| Cloud Run | Servicio `oee-live`, región `us-central1`, entorno de segunda generación |
| Capacidad de la entrada | 1 CPU, 512 MiB, mínimo 0 y máximo 1 instancia a nivel de servicio y revisión |
| Solicitudes de la entrada | Concurrencia 80, timeout 3600 s, facturación por solicitudes |

La capacidad propuesta es una estimación para pocos visitantes y ocho máquinas
simuladas. La dirección `run.app` no requiere comprar un registro de dominio.
La VM, el disco, la IP y el consumo de Cloud Run pueden generar cargos, sujetos
al crédito disponible; no se ha verificado el saldo ni la vigencia de la prueba
de esta cuenta. Un WebSocket abierto mantiene activa la instancia de Cloud Run.
Detener la VM no elimina los cargos del disco ni de la IP reservada. Esta
preparación no crea otro Cloud SQL.

El proyecto accesible para esta VM es `keepcoodingoee`, con dos letras `o` en
`cooding`. La referencia anterior de Cloud SQL en el README no se ha verificado
contra este proyecto; no se ha confirmado la pertenencia de aquella instancia
ni se ha cambiado su connection name, dirección o configuración.

## Revisar y crear

Se necesita Google Cloud CLI, una sesión autenticada y facturación habilitada en
el proyecto. El script busca `gcloud` en `PATH` y en
`%LOCALAPPDATA%\OeeLiveTools\google-cloud-sdk\bin\gcloud.cmd`.
También acepta `-GcloudPath` con la ruta de una instalación existente.
Si no están definidas, prepara `CLOUDSDK_CONFIG` en
`%LOCALAPPDATA%\OeeLiveTools\gcloud-config` y `CLOUDSDK_PYTHON` con el Python 3.12
del entorno `backend/.venv`. Respeta las variables que ya tenga el proceso.

Desde la raíz del repositorio, en PowerShell:

```powershell
$env:CLOUDSDK_CONFIG = "$env:LOCALAPPDATA\OeeLiveTools\gcloud-config"
$env:CLOUDSDK_PYTHON = (Resolve-Path 'backend/.venv/Scripts/python.exe').Path
$gcloud = Join-Path $env:LOCALAPPDATA 'OeeLiveTools/google-cloud-sdk/bin/gcloud.cmd'
& $gcloud auth login
.\scripts\gcp\provision.ps1 -Plan
# Sin opciones equivale a -Plan.
.\scripts\gcp\provision.ps1 -Apply
```

`-Plan` solo consulta la cuenta, las APIs habilitadas y los recursos. No habilita
APIs ni inicia sesiones de autenticación. Si falta CLI o sesión, muestra el plan
local y avisa de que no comprobó recursos. Si Compute API está deshabilitada,
informa de ello y termina sin inventariar recursos.

`-Apply` puede habilitar Compute Engine, IAP y OS Login cuando falten. Requiere
permisos para habilitar servicios y crear redes, firewalls, direcciones, discos
e instancias. No asigna roles IAM ni modifica la configuración global de gcloud.
Para administrar por SSH se necesitan acceso IAP
(`roles/iap.tunnelResourceAccessor`) y OS Login con sudo
(`roles/compute.osAdminLogin`), además del acceso al proyecto necesario para
consultar la instancia. Los roles los gestiona el administrador del proyecto.

Antes de crear recursos, comprueba todos los nombres previstos. Solo reutiliza
recursos con la descripción propia del script y la configuración esperada.
Rechaza nombres ocupados, otra zona/región, una IP utilizada por otra instancia,
un disco huérfano con el nombre de la VM o reglas/subredes inesperadas dentro de
la VPC dedicada. No borra, reajusta, reinicia ni adopta recursos existentes.
Una ejecución interrumpida puede repetirse: conservará lo creado y completará lo
que falte. No hay eliminación automática si GCP rechaza una operación.

Los parámetros `-Project`, `-Region`, `-Zone` y `-VmName` permiten elegir el destino
antes de crearlo; la zona debe pertenecer a la región indicada. Los nombres de
red, subred, IP y firewalls se derivan de `VmName`.

## Comprobar el servidor

El script de arranque instala Docker Engine, Buildx y Compose desde el repositorio
APT oficial de Docker para Debian. Prepara `/opt/oee-live` y el swap; no añade
usuarios al grupo `docker`, no copia el proyecto y no contiene credenciales.
Si detecta paquetes Docker incompatibles, se detiene sin desinstalarlos.
En posteriores arranques reutiliza la instalación completada.

La creación de la VM finaliza antes que la instalación de paquetes. Espera a que
termine el arranque y entra mediante IAP, incluso aunque exista una IP pública:

```powershell
$gcloud = Join-Path $env:LOCALAPPDATA 'OeeLiveTools/google-cloud-sdk/bin/gcloud.cmd'
& $gcloud compute ssh oee-demo --project=keepcoodingoee --zone=us-central1-a --tunnel-through-iap
```

En la VM:

```sh
sudo journalctl -u google-startup-scripts.service --no-pager -n 100
sudo tail -n 100 /var/log/oee-bootstrap.log
sudo test -f /var/lib/oee-live/bootstrap-v1.complete
sudo docker info --format '{{.ServerVersion}}'
sudo docker compose version
free -h
sudo swapon --show
```

El marcador y las comprobaciones Docker deben pasar antes del primer despliegue.
El bootstrap por sí solo no publica una página web: PostgreSQL, Redis, API, Next
y el simulador se ejecutan después como contenedores.

## Entrada de Google y origen en la VM

La ruta pública es navegador → Cloud Run → Caddy en la VM → frontend o
API. Cloud Run proporciona HTTPS en `run.app`; la conexión hacia la VM también
usa HTTPS con el hostname `oee-live.34.57.59.112.sslip.io`. La base de datos y la
captura continua de Modbus no se trasladan a Cloud Run.

Se habilitaron las APIs de Cloud Run y Artifact Registry y se creó el repositorio
`oee-live` en `us-central1`. La cuenta de servicio `oee-gateway` no tiene roles
asignados en el proyecto: el proxy no necesita leer datos ni secretos de GCP.
Su imagen se construye desde `scripts/gcp/cloud-run/`.

En `/opt/oee-live/.env.demo`, `DOMAIN` conserva el hostname del origen y
`PUBLIC_DOMAIN` contiene `oee-live-940610535384.us-central1.run.app`, sin esquema
ni ruta. El tercer archivo `docker-compose.cloud-run.yml` cambia las URLs
públicas de la API y del frontend, manteniendo el certificado del origen. Hay
que reconstruir el frontend porque `NEXT_PUBLIC_*` queda incrustado en la
imagen. `deploy-demo.sh` y `backup-demo.sh` añaden este archivo automáticamente
cuando encuentran `PUBLIC_DOMAIN` en el entorno privado.

`Caddyfile.cloud-run-origin` redirige las visitas directas al hostname anterior
hacia la dirección de Google y presenta el hostname público a la API y a Next.
La cabecera `X-OEE-Gateway` selecciona la ruta del proxy; no autentica al usuario
ni sustituye los permisos de la aplicación. Las cuentas y contraseñas se
conservan, pero es necesario iniciar sesión de nuevo en el nuevo hostname.

La exclusión `oee-live-request-credentials` del sink de Logging `_Default`
descarta únicamente los registros automáticos `run.googleapis.com/requests`
del servicio Cloud Run `oee-live`, para evitar persistir tokens enviados en la
URL de WebSocket. Se conservan los registros de auditoría y los del contenedor;
Caddy filtra el parámetro `token`, las cabeceras de autenticación y las cookies.
No se debe añadir otro destino de registros de solicitudes sin revisar esta
misma protección.

## Alternativa Cloud SQL

El archivo `docker-compose.cloud.yml` describe una alternativa que no se utiliza
en esta demo. Exige dominio HTTPS, correo ACME, SMTP y URLs de base de datos
separadas para aplicación y migraciones. Sus valores no van en metadata de la
VM ni en el script de arranque.

La conexión directa a Cloud SQL requiere autorizar la IP de salida `/32` de la
VM, conservando las redes autorizadas existentes. El script no modifica Cloud
SQL, sus usuarios, sus permisos ni sus datos. No requiere una cuenta de servicio
en la VM porque no instala Cloud SQL Auth Proxy.
Antes de esa fase se debe verificar el proyecto y la instancia de Cloud SQL;
crear la VM en `keepcoodingoee` no confirma la referencia previa del README.

No se ejecuta automáticamente `scripts/configure-cloudsql.py`: ese programa
modifica permisos de base de datos y, si ya existe `backend/.env`, termina antes
de generar `.env.cloud.runtime`. La configuración privada del servidor está
separada del entorno local, que no se ha sobrescrito.

El Compose `prod+demo` incluye el simulador directamente, sin activar perfiles.
El perfil `demo` solo corresponde a la alternativa Cloud SQL. Dentro de Docker
las máquinas demo deben apuntar a `simulator:5020`; restaurar la base local de
desarrollo podría conservar hosts `127.0.0.1`, que no son válidos allí.

El detalle de Compose y las migraciones está en el [README](../README.md).

## Desplegar la demo con PostgreSQL en la VM

El despliegue de examen usa `docker-compose.prod.yml` junto con
`docker-compose.demo.yml`, base propia `oee_demo` en PostgreSQL 16 de la VM y
Mailpit interno. No importa datos ni cuentas de la base local de desarrollo.
No depende de la instancia de Cloud SQL pendiente de verificación. La entrada
por Cloud Run añade `docker-compose.cloud-run.yml` y reutiliza esta misma base.

Para la primera instalación, después de copiar una release completa a
`/opt/oee-live/releases/RELEASE`, ejecuta en la VM, reemplazando `RELEASE` por el
nombre del directorio subido. La demo publicada ya completó esta instalación;
no es necesario volver a ejecutar el seed para actualizar el código.

```sh
sudo bash /opt/oee-live/releases/RELEASE/scripts/gcp/deploy-demo.sh --phase prepare --release /opt/oee-live/releases/RELEASE
sudo bash /opt/oee-live/releases/RELEASE/scripts/gcp/deploy-demo.sh --phase build --release /opt/oee-live/releases/RELEASE
sudo bash /opt/oee-live/releases/RELEASE/scripts/gcp/deploy-demo.sh --phase start --release /opt/oee-live/releases/RELEASE
```

`prepare` exige el marcador del bootstrap y crea `/opt/oee-live/.env.demo` con
modo `0600` y contraseñas aleatorias, solo si todavía no existe. Nunca muestra
su contenido ni sobrescribe credenciales. `private/` y `backups/` usan `0700`;
`releases/`, `0755`. Las fases se bloquean entre sí para evitar dos despliegues
simultáneos. El directorio `backups/` se prepara vacío: este script no realiza
respaldos automáticos.

`build` valida Compose y compila frontend, API y simulador secuencialmente.
`start` valida Caddy, arranca PostgreSQL/Redis/Mailpit/simulador, aplica migraciones
y ejecuta el seed privado antes de arrancar API, colector y frontend. El helper
genera las cuentas owner y viewer en archivos `0600` dentro de `private/`;
las credenciales no aparecen en los logs. Repetir las fases conserva el entorno,
los volúmenes y las identidades existentes; no ejecuta `down` ni restablece datos.

Mailpit captura hasta 500 mensajes y no publica su buzón. Los correos de alertas
y recuperación de contraseña **no llegan a direcciones externas**. El frontend
advierte de esta limitación en la recuperación de contraseña. Para enviar correo
real se necesita configurar un proveedor SMTP.

## Operación de la release

Todos los comandos siguientes se ejecutan dentro de la VM por SSH/IAP. Usa la
release que se haya desplegado, sin mezclar el Compose de desarrollo o el de
Cloud SQL. El ejemplo siguiente corresponde a la release activa con Cloud Run
y `PUBLIC_DOMAIN` configurado. En una sesión Bash administrativa:

```sh
sudo -i
set -Eeuo pipefail
release=/opt/oee-live/releases/20261022T065320140021Z
test -d "$release"
unset POSTGRES_USER POSTGRES_DB POSTGRES_PASSWORD JWT_SECRET DOMAIN PUBLIC_DOMAIN ACME_EMAIL
unset SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASSWORD SMTP_FROM SMTP_STARTTLS SIMULATOR_SEED
compose=(docker compose --project-name oee-live-demo --project-directory "$release"
  --env-file /opt/oee-live/.env.demo
  -f "$release/docker-compose.prod.yml" -f "$release/docker-compose.demo.yml"
  -f "$release/docker-compose.cloud-run.yml")
"${compose[@]}" config --quiet
"${compose[@]}" ps
"${compose[@]}" logs --tail=100 api collector caddy
"${compose[@]}" exec -T collector python -m app.collector.health
curl --fail --show-error https://oee-live-940610535384.us-central1.run.app/api/v1/health
```

Las credenciales permanecen en `.env.demo` y `private/`, con permisos exclusivos
de root. No uses `docker compose config` sin `--quiet` para compartir diagnósticos:
la salida expandida contiene variables privadas. Los logs se limitan a tres
archivos de 10 MB por servicio. Solo Caddy publica puertos; PostgreSQL, Redis,
Mailpit y los puertos de control del simulador quedan internos.

Para consultar el estado y la URL del servicio de entrada desde PowerShell:

```powershell
& $gcloud run services describe oee-live --project=keepcoodingoee --region=us-central1 --format='yaml(status.url,status.conditions)'
```

## Volver a la entrada directa de la VM

La reversión de este cambio no requiere restaurar PostgreSQL ni generar cuentas.
La imagen anterior del frontend está guardada como
`oee-live-demo-frontend:pre-runapp`. En una sesión administrativa, comprueba
primero que esa imagen y la release anterior existen. Guarda una copia privada
de `.env.demo`, elimina únicamente su línea `PUBLIC_DOMAIN` y conserva `DOMAIN`
y todas las credenciales. Vuelve a etiquetar la imagen anterior y arranca con
los dos archivos originales:

```sh
previous_release=/opt/oee-live/releases/20261022T043123991108Z
test -d "$previous_release"
docker image inspect oee-live-demo-frontend:pre-runapp > /dev/null
docker tag oee-live-demo-frontend:pre-runapp oee-live-demo-frontend:latest
flock -n /opt/oee-live/private/.deploy.lock docker compose \
  --project-name oee-live-demo --project-directory "$previous_release" \
  --env-file /opt/oee-live/.env.demo \
  -f "$previous_release/docker-compose.prod.yml" \
  -f "$previous_release/docker-compose.demo.yml" \
  up -d --wait --wait-timeout 180
curl --fail --show-error https://oee-live.34.57.59.112.sslip.io/api/v1/health
```

Verifica el login, los datos vivos y WebSocket en el hostname anterior. No uses
`down -v`, no repitas el seed y no borres recursos como parte de esta reversión.

## Respaldo SQL y restauración

El respaldo manual no detiene servicios ni modifica datos. Usa `pg_dump` en
formato custom, valida que `pg_restore` pueda leer su índice y guarda un checksum.
El directorio queda en `backups/` con modo `0700`; sus archivos usan `0600`.

```sh
bash /opt/oee-live/backup-demo.sh --release "$release"
```

La ruta completada se imprime al terminar. Un fallo deja archivos `.partial` y
no se anuncia como respaldo terminado. La validación del índice no sustituye una
restauración de prueba. El dump contiene datos y hashes de contraseñas: consérvalo
privado y copia un respaldo fuera de la VM para cubrir una pérdida del disco.

Este script respalda **solo `oee_demo`**. No incluye `.env.demo`, `private/`, fotos
del volumen `uploads`, certificados de Caddy ni Redis. Para recuperar la VM
completa también se necesita una copia privada de `.env.demo`, `private/` y
`uploads`; los archivos deben corresponder al mismo entorno. En la restauración
SQL dentro de la misma VM, esos archivos y volúmenes se conservan.

Primero restaura el dump en una base nueva. Estos comandos mantienen intacta la
base activa; usa exclusivamente una copia propia cuyo checksum sea correcto:

```sh
backup=/opt/oee-live/backups/DIRECTORIO_DEL_RESPALDO
(cd "$backup" && sha256sum --check SHA256SUMS)
restore_id=$(date -u +%Y%m%d%H%M%S)
candidate="oee_restore_${restore_id}"
previous="oee_before_${restore_id}"
"${compose[@]}" exec -T postgres createdb --no-password -U oee -T template0 "$candidate"
"${compose[@]}" exec -T postgres pg_restore --no-password -U oee -d "$candidate" \
  --no-owner --no-acl --exit-on-error --single-transaction < "$backup/database.dump"
"${compose[@]}" exec -T postgres psql -X --no-password -U oee -d "$candidate" \
  -v ON_ERROR_STOP=1 -c 'SELECT version_num FROM alembic_version; SELECT count(*) AS machines FROM machines; SELECT count(*) AS samples FROM production_samples;'
```

Comprueba la revisión y los conteos contra el respaldo elegido. La demo inicial
tiene ocho máquinas; los usuarios pueden cambiar ese número posteriormente.
Si solo se está ensayando recuperación, termina aquí: no sustituyas `oee_demo`.

Para una recuperación efectiva, abre una ventana de mantenimiento, conserva
también un respaldo del estado actual y ejecuta lo siguiente **solo después de
validar la candidata**. La sustitución guarda la base anterior con otro nombre;
no elimina sus datos:

```sh
bash /opt/oee-live/backup-demo.sh --release "$release"
"${compose[@]}" stop caddy frontend api collector simulator
"${compose[@]}" exec -T postgres psql -X --no-password -U oee -d postgres \
  -v ON_ERROR_STOP=1 -v candidate="$candidate" -v previous="$previous" \
  --single-transaction <<'SQL'
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname = 'oee_demo' AND pid <> pg_backend_pid();
ALTER DATABASE oee_demo RENAME TO :"previous";
ALTER DATABASE :"candidate" RENAME TO oee_demo;
SQL
"${compose[@]}" exec -T redis redis-cli FLUSHDB
"${compose[@]}" run --rm migrate
"${compose[@]}" up -d --wait --wait-timeout 180
curl --fail --show-error https://oee-live-940610535384.us-central1.run.app/api/v1/health
```

`FLUSHDB` descarta exclusivamente la caché del servicio Redis de esta demo para
que los datos vivos se reconstruyan desde PostgreSQL. No ejecutes `down -v`, no
vuelvas a crear `.env.demo` ni regeneres cuentas. Si cualquier paso falla,
conserva ambas bases y revisa el error antes de reabrir el acceso. Después verifica
acceso, ocho equipos esperados, datos en vivo y una consulta histórica; conservar
la base anterior permite revisar la recuperación antes de retirarla manualmente.

## Fuentes de configuración

- [Docker Engine en Debian](https://docs.docker.com/engine/install/debian/).
- [Crear instancias con gcloud](https://docs.cloud.google.com/sdk/gcloud/reference/compute/instances/create).
- [SSH mediante IAP y reglas de red](https://docs.cloud.google.com/iap/docs/using-tcp-forwarding).
- [Configuración de OS Login](https://docs.cloud.google.com/compute/docs/oslogin/set-up-oslogin).
- [Máquinas E2](https://docs.cloud.google.com/compute/docs/general-purpose-machines).
- [Redes autorizadas de Cloud SQL](https://docs.cloud.google.com/sql/docs/postgres/authorize-networks).
- [pg_dump de PostgreSQL 16](https://www.postgresql.org/docs/16/app-pgdump.html).
- [pg_restore de PostgreSQL 16](https://www.postgresql.org/docs/16/app-pgrestore.html).
- [URL HTTPS de Cloud Run](https://docs.cloud.google.com/run/docs/triggering/https-request).
- [WebSocket en Cloud Run](https://docs.cloud.google.com/run/docs/triggering/websockets).
- [Precios de Cloud Run](https://cloud.google.com/run/pricing).

## Estado verificado el 22 de octubre de 2026

Servidor creado en `keepcoodingoee`, zona `us-central1-a`:

- VM `oee-demo`, estado `RUNNING`, `e2-medium` y disco de 30 GB.
- IP fija `34.57.59.112`, recurso `oee-demo-ip`, asociada a la VM.
- SSH mediante IAP comprobado con OS Login; no se concedieron roles adicionales.
- Bootstrap finalizado; marcador `/var/lib/oee-live/bootstrap-v1.complete` presente.
- Docker Engine `29.9.2`, Docker Compose `v5.6.1`; contenedor `hello-world` ejecutado correctamente y eliminado con `--rm`.
- RAM observada 3.8 GiB y swap activo de 2 GiB. `/opt/oee-live` preparado.
- El plan posterior valida todos los recursos y no propone duplicarlos.

La release activa es `/opt/oee-live/releases/20261022T065320140021Z`, con Compose
`prod+demo+cloud-run` y checksum del archivo de release
SHA-256 `d4258c2ce179289d692e46669020c7891e47d03333225190d699f8ded7ba9709`.
Todos los servicios de la VM están saludables. La revisión de Cloud Run
`oee-live-00001-bkj` recibe el 100 % del tráfico; su imagen tiene digest
`sha256:aa77874a4fc20b1b3dfa1f0fe5458d76bfed603051787e02cb930e609f9b8600`.
La imagen del frontend reconstruida para el nuevo hostname tiene ID
`b1133dc21ff5`. Se conservaron la base de datos y las cuentas, sin repetir el seed.

La release anterior `20261022T043123991108Z` queda disponible para la reversión.
Introdujo la corrección que reutiliza agregados históricos, calcula con muestras
los bordes exactos y actualiza el heartbeat del colector después de confirmar
la transacción; estos cambios se conservan en la release activa.

PostgreSQL 16 aloja `oee_demo`, con migraciones hasta `0005`, siete días de datos
iniciales y ocho máquinas simuladas. Sus cavidades activas, por unidad del 1 al 8,
son `4, 2, 1, 4, 2, 1, 4, 2`. Los datos en vivo proceden del simulador Modbus;
no se ha conectado esta demo a las máquinas de una planta real.

La verificación de la dirección `run.app` terminó con **15 de 15 comprobaciones
correctas**, entre las 01:02:35 y las 01:03:01 de Ciudad de México
(07:02:35–07:03:01 UTC):

- HTTPS y health con PostgreSQL y Redis disponibles.
- Login, rotación de refresh y logout; cookie `Secure` y `HttpOnly`.
- Viewer con acceso de lectura; escritura rechazada con `403` y endpoints
  privados sin sesión rechazados con `401`.
- Ocho máquinas y ocho contextos de producción.
- Telemetría histórica de ocho variables, con 240 puntos; lectura de telemetría
  Modbus y avance real de los contadores. Se observó un shot convertido en
  1, 2 y 4 piezas según las cavidades activas.
- CSV de siete fechas con 56 filas; tablero público sin campos privados y ocho
  mensajes recibidos por WebSocket seguro.

La evidencia está en
`.git/runtime/gcp/verification-20261022T070235273628Z.json` (archivo local, fuera
de Git). Otras **11 de 11 comprobaciones** validaron redirecciones, 19 archivos
estáticos, CORS, cookies y sesión en el nuevo hostname, y WebSocket autenticado:
`.git/runtime/gcp/verification-runapp-extra-20261022T070224159497Z.json`.
La revisión de 93 entradas de Cloud Logging encontró cero registros automáticos
de solicitudes y cero coincidencias con los patrones de JWT o token comprobados.

La suite del backend previa terminó con 227 pruebas correctas y 33 pruebas
opcionales de PostgreSQL omitidas porque `localhost:55432` no estaba disponible.
La verificación HTTP/API no ejecuta JavaScript ni sustituye una revisión visual.
El recorrido visual del frontend confirmó 10 de 10 comprobaciones, más registro y baja de cuenta,
en el hostname anterior (F-038). F-040 confirma el recorrido visual en `run.app`:
10 pantallas aprobadas, registro y baja de cuenta de prueba, redirección y enlaces
de idioma correctos, sin cambios adicionales en frontend.

Durante ese recorrido hubo un 503 transitorio en `/api/v1/health`; las cinco
peticiones siguientes respondieron 200. El registro de las 07:02:53 UTC muestra
una respuesta JSON de Uvicorn en 2,99 s, por lo que no se atribuye automáticamente
al arranque en frío de Cloud Run: ese endpoint comprueba PostgreSQL/Redis con
timeouts. No se cambian mínimos ni timeouts a partir de esa única observación.
HSTS, Referrer-Policy, X-Frame-Options y Permissions-Policy quedaron anotados
como mejoras de encabezados; no bloquearon las comprobaciones funcionales.

Los accesos privados están guardados localmente en
`.git/runtime/gcp/private/ACCESO-PROPIETARIO.txt` y
`.git/runtime/gcp/private/ACCESO-PROFESORES.txt`. Comparte con los profesores
únicamente su archivo de acceso viewer; no publiques las credenciales ni el
acceso del propietario en el repositorio.

Existe un respaldo SQL inicial validado en
`/opt/oee-live/backups/oee_demo-20261022T042626Z-uM4tfF` y el helper manual está
instalado en `/opt/oee-live/backup-demo.sh`. No hay un respaldo automático
programado ni se ha declarado completada una restauración de prueba.

También se conservan el respaldo validado
`/opt/oee-live/backups/oee_demo-20261022T063306Z-SXtqOS` y el respaldo previo al
cambio de entrada `/opt/oee-live/backups/oee_demo-20261022T070122Z-6X5271`.
La comparación histórica previa verificó OEE idéntico en las ocho máquinas al
usar agregados en lugar de releer 43.252 muestras; evidencia local:
`.git/runtime/gcp/historical-comparison-20261022.json`.

[Ver la VM en Google Cloud](https://console.cloud.google.com/compute/instancesDetail/zones/us-central1-a/instances/oee-demo?project=keepcoodingoee).

## Releases posteriores del 22 de octubre de 2026

Después de la release `20261022T065320140021Z` se publicaron tres más, con el mismo
`.env.demo`, la misma base de datos y las mismas cuentas, sin repetir el seed ni las
migraciones:

| Release | Contenido | Imagen frontend |
|---|---|---|
| `20261022T075410635554Z` | Tarjetas sin ilustración, anillo de OEE sin filtro, pestaña Datos con consulta por rango/máquinas/vista y Excel con formato, ajustes de histórico y seguimiento. | `f6caa0e0bf33` |
| `20261022T083150494026Z` | Portada como acceso con instrucciones y guía, campana con notificaciones desplegadas, paros de máquina en la pestaña Paros, detalle sin silueta y con disparos, Datos a partir del resumen diario (sin esperar el CSV del servidor), Excel rediseñado. | `3f8fb88f2733` |
| `20261022T085124605787Z` | Backend: caché en Redis del resumen diario de planta para días cerrados (`plant:<id>:summary:<fecha>`, 24 h), que deja la pestaña Datos en segundos. Frontend sin cambios. | `3f8fb88f2733` |
| `20261022T090547849926Z` | Histórico de telemetría: abre en 1 h por omisión (8 h, 24 h y 7 d a un clic), 300 puntos por serie y sin refresco automático, porque `telemetry/series` cuesta varios segundos por consulta en la VM y las repeticiones se acumulaban. Frontend solo. | (ver `docker images`) |
| `20261022T091308013348Z` | Histórico: dos variables por omisión y ancla fija del rango (la consulta ya no se repite al cambiar el minuto). Frontend solo. | (ver `docker images`) |
| `20261022T091717495982Z` | Histórico: la consulta de series espera a la lista de variables, así no se lanza dos veces. Frontend solo. | (ver `docker images`) |
| `20261022T093832307261Z` | Portada con un solo panel de acceso y la cuenta de demo al pie, guía como texto; plano con fichas de instrumento por máquina (barra de estado, silueta pequeña, nombre, OEE grande, A/P/Q, corrida) en rejilla a todo el ancho y franja de la escuela al pie. Frontend solo. | (ver `docker images`) |
| `20261022T094745619864Z` | Portada: el acceso de demo se lee de `DEMO_USERNAME` y `DEMO_PASSWORD` del contenedor en cada petición (los nombres `NEXT_PUBLIC_*` se incrustan al compilar y no sirven en tiempo de ejecución). `.env.demo` ya define ambas. Frontend solo. | (ver `docker images`) |
| `20261022T101851860164Z` | Seguridad y acabado: límite de intentos en login (10 por IP y 50 por usuario en ventanas de 10 min desde la release siguiente; 10 y 10 en esta), registro (10 por IP) y recuperación (5 por IP) con contadores en Redis, 429 `RATE_LIMITED`; sin cabecera `x-powered-by`; `uuid` fijado a versión corregida; anillo de OEE liso y gráficas de telemetría sin banda. Backend y frontend. | (ver `docker images`) |
| `20261022T103709873326Z` | Login: 10 intentos por dirección y 50 por usuario en ventanas de 10 min (la cuenta compartida de demo no se bloquea por errores ajenos). Backend solo. | (ver `docker images`) |

Procedimiento usado, con el script `/tmp/oee-datos-vm.sh` (copia de `scratchpad/oee-datos-vm.sh`
del equipo de frontend; toma el mismo candado que `deploy-demo.sh`):

```sh
# local: empaquetar y subir
backend/.venv/Scripts/python.exe scripts/gcp/package-release.py
gcloud compute scp .git/runtime/gcp/releases/<ts>/oee-release.tar.gz oee-demo:/tmp/oee-source-<ts>.tar.gz --tunnel-through-iap
# VM, como root
bash /tmp/oee-datos-vm.sh extract <ts> <sha256>        # verifica el hash, extrae en /opt/oee-live/releases/<ts>, valida Compose
bash /opt/oee-live/backup-demo.sh --release /opt/oee-live/releases/<activa>
bash /tmp/oee-datos-vm.sh build <ts>                   # imagen del frontend; conserva la anterior como :pre-datos / :pre-datos2
bash /tmp/oee-datos-vm.sh build-api <ts>               # solo si cambió backend/; conserva :pre-cache
bash /tmp/oee-datos-vm.sh apply <ts>                   # docker compose up -d --wait desde la release nueva
bash /tmp/oee-datos-vm.sh verify <ts>                  # servicios, imagen en uso, salud del colector y salud pública
```

Reversión: `bash /tmp/oee-datos-vm.sh rollback <ts> <release anterior>` vuelve a etiquetar la
imagen anterior del frontend y levanta Compose desde la release previa; para el API, re-etiquetar
`oee-live-backend:pre-cache` como `oee-live-backend:production` antes de `apply`.

Variables opcionales de la portada (se leen en el servidor de Next, no en el build): `DEMO_USERNAME`
(por omisión `demo`) y `DEMO_PASSWORD` en `.env.demo`; `docker-compose.cloud-run.yml` las pasa al
contenedor del frontend con el mismo nombre; el servidor de Next las lee en cada petición. Sin
`DEMO_PASSWORD`, la portada solo muestra el usuario.
