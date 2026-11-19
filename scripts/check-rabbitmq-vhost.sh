#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${RABBITMQ_NAMESPACE:-rabbitmq}"
RELEASE_LABEL="${RABBITMQ_RELEASE_LABEL:-app.kubernetes.io/name=rabbitmq}"
VHOST="${1:-hotspot}"

POD="$(kubectl -n "$NAMESPACE" get pods -l "$RELEASE_LABEL" -o jsonpath='{.items[0].metadata.name}')"
if [[ -z "$POD" ]]; then
  echo "No RabbitMQ pod found in namespace '$NAMESPACE' with label '$RELEASE_LABEL'"
  exit 1
fi

echo "Checking RabbitMQ vhost '$VHOST' in pod '$POD'..."
if kubectl -n "$NAMESPACE" exec "$POD" -- rabbitmqctl list_vhosts -q | grep -Fxq "$VHOST"; then
  echo "OK: vhost '$VHOST' exists"
  exit 0
fi

echo "MISSING: vhost '$VHOST' does not exist"
exit 2
