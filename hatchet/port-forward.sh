#!/usr/bin/env bash
set -euo pipefail

NS=hatchet
ADDR=0.0.0.0   # use 127.0.0.1 unless LAN/containers truly need it

PIDS=()
shutdown() {
  echo -e "\nStopping port-forwards..."
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  exit 0
}
trap shutdown INT TERM

# Belt-and-suspenders: only matters if a previous run crashed before cleanup.
# With the trap working you can usually delete these two lines (and the sudo prompt).
pids=$(sudo lsof -t -i :7070 -i :8080 -i :8888 2>/dev/null || true)
[ -n "$pids" ] && echo "$pids" | xargs -r sudo kill -9

kubectl -n "$NS" port-forward --address "$ADDR" svc/hatchet-stack-engine 7070:7070 & PIDS+=($!)
kubectl -n "$NS" port-forward --address "$ADDR" svc/hatchet-stack-api    8080:8080 & PIDS+=($!)
kubectl -n "$NS" port-forward --address "$ADDR" svc/caddy                8888:8080 & PIDS+=($!)

echo "Hatchet up — engine:7070  api:8080  caddy:8888.  Ctrl+C to stop."
wait
