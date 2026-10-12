#!/bin/sh
# Moonlit Cove's container start: the wish board keeps its wishes in $DATA_DIR (a Railway volume at /data).
# Volumes are usually mounted owned by root, so when the container starts as root this hands the directory to
# the unprivileged node user, then drops to that user to run the server. Started as any other user, it just runs it.
set -e
# Railway says where an attached volume is mounted; the server uses the same place
DATA_DIR="${RAILWAY_VOLUME_MOUNT_PATH:-${DATA_DIR:-/data}}"
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown -R node:node "$DATA_DIR" || echo "warning: could not hand $DATA_DIR to the node user; wishes may not be kept" >&2
  exec su-exec node "$@"
fi
exec "$@"
