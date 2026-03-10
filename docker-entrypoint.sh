#!/bin/sh
set -eu

# Ensure server-side persistence dir is writable.
# Prefer dropping privileges to `nodeapp`, but fall back to root if the mount
# doesn't support chown/chmod (common on some host filesystems).

USER_NAME="nodeapp"
GROUP_NAME="nodejs"

RAW_DATA_DIR="${MAGIC_RESUME_DATA_DIR:-${DATA_DIR:-data}}"

case "$RAW_DATA_DIR" in
  /*) DATA_DIR="$RAW_DATA_DIR" ;;
  *) DATA_DIR="/app/$RAW_DATA_DIR" ;;
esac

mkdir -p "$DATA_DIR" 2>/dev/null || true
chown -R "$USER_NAME:$GROUP_NAME" "$DATA_DIR" 2>/dev/null || true
chmod -R u+rwX,g+rwX "$DATA_DIR" 2>/dev/null || true

if command -v su-exec >/dev/null 2>&1; then
  if su-exec "$USER_NAME" sh -c "touch \"$DATA_DIR/.writetest\" && rm -f \"$DATA_DIR/.writetest\"" >/dev/null 2>&1; then
    exec su-exec "$USER_NAME" "$@"
  fi
fi

echo "[magic-resume] Warning: '$DATA_DIR' is not writable for $USER_NAME, running as root." >&2
exec "$@"

