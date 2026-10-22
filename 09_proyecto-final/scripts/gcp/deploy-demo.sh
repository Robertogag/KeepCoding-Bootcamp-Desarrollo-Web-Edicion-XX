#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

usage() {
    echo "Usage: $0 --phase prepare|build|start --release /opt/oee-live/releases/RELEASE"
}

phase=''
release=''
while [[ $# -gt 0 ]]; do
    case "$1" in
        --phase) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; phase=$2; shift 2 ;;
        --release) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; release=$2; shift 2 ;;
        --help|-h) usage; exit 0 ;;
        *) usage >&2; exit 2 ;;
    esac
done
[[ ${EUID} -eq 0 ]] || { echo "Run as root" >&2; exit 1; }
[[ ${phase} == prepare || ${phase} == build || ${phase} == start ]] || { usage >&2; exit 2; }
[[ -n ${release} && -d ${release} ]] || { echo "Release directory is missing" >&2; exit 1; }
[[ -f /var/lib/oee-live/bootstrap-v1.complete ]] || {
    echo "The OEE VM bootstrap has not completed" >&2
    exit 1
}
release=$(realpath -e -- "${release}")
case "${release}" in
    /opt/oee-live/releases/*) ;;
    *) echo "Release must resolve inside /opt/oee-live/releases" >&2; exit 1 ;;
esac
for required in docker-compose.prod.yml docker-compose.demo.yml Caddyfile; do
    [[ -f ${release}/${required} ]] || { echo "Release lacks ${required}" >&2; exit 1; }
done
for directory in /opt/oee-live /opt/oee-live/releases /opt/oee-live/private /opt/oee-live/backups; do
    [[ ! -L ${directory} ]] || { echo "Deployment directories cannot be symlinks" >&2; exit 1; }
done
command -v python3 >/dev/null || { echo "Python 3 is required to prepare private configuration" >&2; exit 1; }
command -v docker >/dev/null || { echo "Docker is missing" >&2; exit 1; }
install -d -m 0755 /opt/oee-live/releases
install -d -m 0700 /opt/oee-live/private /opt/oee-live/backups
exec 9>/opt/oee-live/private/.deploy.lock
flock -n 9 || { echo "Another deployment phase is running" >&2; exit 1; }

env_file=/opt/oee-live/.env.demo
python3 - "${env_file}" <<'PY'
import os
import secrets
import stat
import sys
from pathlib import Path

target = Path(sys.argv[1])
try:
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
except FileExistsError:
    info = target.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or stat.S_IMODE(info.st_mode) != 0o600:
        raise SystemExit("Existing .env.demo must be a root-owned regular file with mode 0600")
    print("Existing private environment preserved")
else:
    with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
        stream.write(
            "POSTGRES_USER=oee\n"
            "POSTGRES_DB=oee_demo\n"
            f"POSTGRES_PASSWORD={secrets.token_hex(32)}\n"
            f"JWT_SECRET={secrets.token_urlsafe(64)}\n"
            "DOMAIN=oee-live.34.57.59.112.sslip.io\n"
            "ACME_EMAIL=keepcoodingoeeproject@gmail.com\n"
            "SMTP_HOST=mailpit\nSMTP_PORT=1025\nSMTP_STARTTLS=false\n"
            "SMTP_USER=\nSMTP_PASSWORD=\n"
            'SMTP_FROM="OEE Live Demo <noreply@oee-live.34.57.59.112.sslip.io>"\n'
            "SIMULATOR_SEED=42\n"
        )
        stream.flush()
        os.fsync(stream.fileno())
    print("Private environment created with mode 0600")
PY

# The dedicated env file, not an administrator's login environment, selects the deployment.
unset POSTGRES_USER POSTGRES_DB POSTGRES_PASSWORD JWT_SECRET DOMAIN PUBLIC_DOMAIN ACME_EMAIL
unset SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASSWORD SMTP_FROM SMTP_STARTTLS SIMULATOR_SEED
unset COMPOSE_FILE COMPOSE_PROJECT_NAME COMPOSE_PROFILES
export COMPOSE_PARALLEL_LIMIT=1
cd -- "${release}"
compose=(docker compose --project-name oee-live-demo --project-directory "${release}"
    --env-file "${env_file}" -f "${release}/docker-compose.prod.yml" -f "${release}/docker-compose.demo.yml")
if grep -q '^PUBLIC_DOMAIN=' "${env_file}"; then
    [[ -f ${release}/docker-compose.cloud-run.yml ]] || { echo "Cloud Run overlay is missing" >&2; exit 1; }
    compose+=(-f "${release}/docker-compose.cloud-run.yml")
fi
"${compose[@]}" config --quiet

case "${phase}" in
    prepare)
        echo "Private configuration and deployment directories are ready"
        ;;
    build)
        for service in frontend api simulator; do
            echo "Building ${service}"
            "${compose[@]}" build "${service}"
        done
        ;;
    start)
        helper=${release}/scripts/gcp/seed-public-demo.py
        [[ -f ${helper} ]] || { echo "The public demo seed helper is missing" >&2; exit 1; }
        "${compose[@]}" run --rm --no-deps caddy \
            caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
        "${compose[@]}" up -d --wait --wait-timeout 180 postgres redis mailpit simulator
        "${compose[@]}" run --rm migrate
        "${compose[@]}" run --rm --no-deps --user 0 \
            --volume "${helper}:/deploy/seed-public-demo.py:ro" \
            --volume /opt/oee-live/private:/private \
            --env OEE_PUBLIC_DEMO_VM=1 \
            api python /deploy/seed-public-demo.py \
            --database-name oee_demo --private-dir /private --config /app/config/machines.yaml
        "${compose[@]}" up -d --wait --wait-timeout 180
        echo "Demo containers are ready; verify public HTTPS, login and live data before sharing the URL"
        ;;
esac
