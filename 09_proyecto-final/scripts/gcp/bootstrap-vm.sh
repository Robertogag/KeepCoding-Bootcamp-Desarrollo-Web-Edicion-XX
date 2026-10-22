#!/usr/bin/env bash
set -Eeuo pipefail
umask 022

exec > >(tee -a /var/log/oee-bootstrap.log) 2>&1
trap 'echo "OEE bootstrap failed at line ${LINENO}" >&2' ERR

[[ ${EUID} -eq 0 ]] || { echo "Run as root" >&2; exit 1; }
source /etc/os-release
[[ ${ID} == debian && ${VERSION_ID} == 12 ]] || {
    echo "This bootstrap requires Debian 12" >&2
    exit 1
}

install -d -m 0755 /opt/oee-live /var/lib/oee-live
if [[ ! -f /var/lib/oee-live/bootstrap-v1.complete ]]; then
    # A fresh VM is expected; do not remove another installation's packages.
    for package in docker.io docker-compose docker-doc docker-buildx podman-docker containerd runc; do
        if dpkg-query -W -f='${Status}' "${package}" 2>/dev/null | grep -q 'install ok installed'; then
            echo "Conflicting package ${package}; no packages removed" >&2
            exit 1
        fi
    done
    export DEBIAN_FRONTEND=noninteractive
    apt-get -o DPkg::Lock::Timeout=120 update
    apt-get -o DPkg::Lock::Timeout=120 install -y ca-certificates curl
    install -d -m 0755 /etc/apt/keyrings
    curl --fail --silent --show-error --location --retry 5 \
        https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: bookworm
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
    apt-get -o DPkg::Lock::Timeout=120 update
    apt-get -o DPkg::Lock::Timeout=120 install -y \
        docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

if [[ ! -e /swapfile ]]; then
    if [[ -n $(swapon --show=NAME --noheadings) ]]; then
        echo "Existing swap detected; no extra swap file created"
    else
        install -m 0600 /dev/null /swapfile
        dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
        mkswap /swapfile
    fi
fi
if [[ -f /swapfile ]]; then
    [[ $(blkid -s TYPE -o value /swapfile) == swap ]] || {
        echo "Existing /swapfile is not swap; it was not overwritten" >&2
        exit 1
    }
    chmod 0600 /swapfile
    if ! swapon --show=NAME --noheadings | grep -Fxq /swapfile; then
        swapon /swapfile
    fi
    if ! awk '$1 == "/swapfile" && $3 == "swap" { found = 1 } END { exit !found }' /etc/fstab; then
        printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
    fi
fi

systemctl enable --now docker
docker info --format '{{.ServerVersion}}'
docker compose version
touch /var/lib/oee-live/bootstrap-v1.complete
echo "OEE server prepared. /opt/oee-live is ready; the application is not deployed."
