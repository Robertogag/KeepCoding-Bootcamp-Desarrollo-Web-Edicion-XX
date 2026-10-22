#!/usr/bin/env bash
# Despliegue mínimo de una release nueva: solo cambia el frontend; API, simulador y base siguen igual.
set -Eeuo pipefail
umask 022
[[ $EUID == 0 && -f /var/lib/oee-live/bootstrap-v1.complete ]] || exit 1
phase=${1:?phase}
ts=${2:?release timestamp}
release=/opt/oee-live/releases/$ts
env_file=/opt/oee-live/.env.demo
exec 9>/opt/oee-live/private/.deploy.lock
flock -n 9 || { echo 'Another deployment is running'; exit 1; }
compose() {
  docker compose --project-name oee-live-demo --project-directory "$release" \
    --env-file "$env_file" -f "$release/docker-compose.prod.yml" \
    -f "$release/docker-compose.demo.yml" -f "$release/docker-compose.cloud-run.yml" "$@"
}
case $phase in
  extract)
    sha=${3:?sha256}
    archive=/tmp/oee-source-$ts.tar.gz
    [[ -f $archive ]] || { echo "missing $archive"; exit 1; }
    echo "$sha  $archive" | sha256sum -c -
    [[ ! -e $release ]] || { echo "release dir exists"; exit 1; }
    install -d -m 0755 "$release"
    tar -xzf "$archive" -C "$release" --no-same-owner
    chmod 0755 "$release"/scripts/gcp/*.sh
    ls "$release" | tr '\n' ' '; echo
    grep -q '^PUBLIC_DOMAIN=' "$env_file" || { echo "PUBLIC_DOMAIN missing"; exit 1; }
    grep -o '^PUBLIC_DOMAIN=.*' "$env_file"
    compose config --quiet && echo "compose config OK"
    rm -f -- "$archive"
    ;;
  build)
    compose run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
    if ! docker image inspect oee-live-demo-frontend:pre-datos >/dev/null 2>&1; then
      docker tag oee-live-demo-frontend:latest oee-live-demo-frontend:pre-datos
    fi
    compose build frontend
    docker images --format '{{.Repository}}:{{.Tag}} {{.ID}} {{.CreatedSince}}' | grep '^oee-live-demo-frontend'
    ;;
  build-api)
    if ! docker image inspect oee-live-backend:pre-cache >/dev/null 2>&1; then
      docker tag oee-live-backend:production oee-live-backend:pre-cache
    fi
    compose build api
    docker images --format '{{.Repository}}:{{.Tag}} {{.ID}} {{.CreatedSince}}' | grep '^oee-live-backend'
    ;;
  apply)
    compose up -d --wait --wait-timeout 180
    compose ps --format 'table {{.Service}}\t{{.Status}}'
    ;;
  verify)
    compose ps --format 'table {{.Service}}\t{{.Status}}'
    docker inspect --format '{{.Image}}' oee-live-demo-frontend-1
    compose exec -T collector python -m app.collector.health
    curl -sS --fail -o /dev/null -w 'health %{http_code}\n' https://oee-live-keepcoding.cloud.run/api/v1/health
    ;;
  rollback)
    prev=${3:?previous release timestamp}
    docker tag oee-live-demo-frontend:pre-datos oee-live-demo-frontend:latest
    release=/opt/oee-live/releases/$prev
    compose up -d --wait --wait-timeout 180
    ;;
  *) exit 2 ;;
esac
