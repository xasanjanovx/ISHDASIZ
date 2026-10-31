#!/bin/sh
# Read-only inventory. No environment dumps, command arguments, cleanup or restart.
set -eu
section() { printf '\n%s\n' "$1"; }
section 'Operating system'
cat /etc/os-release
uname -m
section 'CPU and memory'
getconf _NPROCESSORS_ONLN
free -m
section 'Disk capacity'
df -hT
section 'Listening TCP ports'
ss -lntp
section 'Running services'
systemctl list-units --type=service --state=running --no-pager --no-legend || true
section 'Existing application directories'
for base in /opt /srv; do
  if [ -d "$base" ]; then
    find "$base" -maxdepth 3 -type f \( -name 'compose.yaml' -o -name 'docker-compose.yml' -o -name 'package.json' \) -print 2>/dev/null
  fi
done
section 'Directory sizes in KiB'
for item in /opt /srv /var/log /var/lib/docker /var/lib/postgresql; do
  if [ -d "$item" ]; then du -sx "$item" 2>/dev/null || true; fi
done
if command -v docker >/dev/null 2>&1; then
  section 'Docker version and running containers'
  docker version --format '{{.Server.Version}}' || true
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}' || true
  section 'Docker space accounting'
  docker system df || true
fi
