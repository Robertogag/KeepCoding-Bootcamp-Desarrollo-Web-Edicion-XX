#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

if [[ $# -ne 2 || $1 != --release ]]; then
    echo "Usage: $0 --release /opt/oee-live/releases/RELEASE" >&2
    exit 2
fi
[[ ${EUID} -eq 0 ]] || { echo "Run as root" >&2; exit 1; }
[[ -f /var/lib/oee-live/bootstrap-v1.complete ]] || { echo "OEE bootstrap marker is missing" >&2; exit 1; }
release=$(realpath -e -- "$2")
case "${release}" in
    /opt/oee-live/releases/*) ;;
    *) echo "Release must resolve inside /opt/oee-live/releases" >&2; exit 1 ;;
esac
for required in docker-compose.prod.yml docker-compose.demo.yml; do
    [[ -f ${release}/${required} ]] || { echo "Release lacks ${required}" >&2; exit 1; }
done
env_file=/opt/oee-live/.env.demo
[[ -f ${env_file} && ! -L ${env_file} && $(stat -c %a "${env_file}") == 600 &&
    $(stat -c %u "${env_file}") == 0 ]] || { echo "Private environment must be root-owned with mode 0600" >&2; exit 1; }
for directory in /opt/oee-live /opt/oee-live/releases /opt/oee-live/private /opt/oee-live/backups; do
    [[ -d ${directory} && ! -L ${directory} ]] || { echo "Expected deployment directory is missing or symbolic" >&2; exit 1; }
done
[[ $(stat -c %a /opt/oee-live/backups) == 700 ]] || { echo "Backups directory must have mode 0700" >&2; exit 1; }
exec 9>/opt/oee-live/private/.deploy.lock
flock -n 9 || { echo "Another deployment or backup is running" >&2; exit 1; }
unset POSTGRES_USER POSTGRES_DB POSTGRES_PASSWORD JWT_SECRET DOMAIN PUBLIC_DOMAIN ACME_EMAIL
unset SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASSWORD SMTP_FROM SMTP_STARTTLS SIMULATOR_SEED
unset COMPOSE_FILE COMPOSE_PROJECT_NAME COMPOSE_PROFILES
cd -- "${release}"
compose=(docker compose --project-name oee-live-demo --project-directory "${release}"
    --env-file "${env_file}" -f "${release}/docker-compose.prod.yml" -f "${release}/docker-compose.demo.yml")
if grep -q '^PUBLIC_DOMAIN=' "${env_file}"; then
    [[ -f ${release}/docker-compose.cloud-run.yml ]] || { echo "Cloud Run overlay is missing" >&2; exit 1; }
    compose+=(-f "${release}/docker-compose.cloud-run.yml")
fi
"${compose[@]}" config --quiet
actual_database=$("${compose[@]}" exec -T postgres psql -XAt --no-password \
    --username=oee --dbname=oee_demo --set=ON_ERROR_STOP=1 --command='SELECT current_database()')
[[ ${actual_database} == oee_demo ]] || { echo "Unexpected database; backup refused" >&2; exit 1; }

backup_dir=$(mktemp -d "/opt/oee-live/backups/oee_demo-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
trap 'echo "Backup incomplete; private partial files remain in ${backup_dir}" >&2' ERR
"${compose[@]}" exec -T postgres pg_dump --no-password --username=oee --dbname=oee_demo \
    --format=custom --no-owner --no-acl --lock-wait-timeout=10s > "${backup_dir}/database.dump.partial"
"${compose[@]}" exec -T postgres pg_restore --list < "${backup_dir}/database.dump.partial" > /dev/null
mv -- "${backup_dir}/database.dump.partial" "${backup_dir}/database.dump"
printf 'database=oee_demo\nrelease=%s\ncreated_at=%s\n' \
    "${release}" "$(date -u +%FT%TZ)" > "${backup_dir}/manifest.txt"
(
    cd -- "${backup_dir}"
    sha256sum database.dump manifest.txt > SHA256SUMS
)
echo "SQL backup completed: ${backup_dir}"
