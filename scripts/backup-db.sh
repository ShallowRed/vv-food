#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DB="${BACKUP_SOURCE:-$ROOT_DIR/data/foude.sqlite}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups/db}"
KEEP_COUNT="${BACKUP_KEEP:-10}"

if [[ ! -f "$SOURCE_DB" ]]; then
  echo "Base introuvable: $SOURCE_DB" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

timestamp="$(date +%Y%m%d-%H%M%S)"
target="$BACKUP_DIR/foude-$timestamp.sqlite"
tmp_target="$target.tmp"

cp "$SOURCE_DB" "$tmp_target"
mv "$tmp_target" "$target"

mapfile -t backups < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'foude-*.sqlite' -print | sort -r)

if (( ${#backups[@]} > KEEP_COUNT )); then
  for old_backup in "${backups[@]:KEEP_COUNT}"; do
    rm -f "$old_backup"
  done
fi

echo "Backup créé: $target"