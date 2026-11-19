#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${RABBITMQ_NAMESPACE:-rabbitmq}"
RELEASE_LABEL="${RABBITMQ_RELEASE_LABEL:-app.kubernetes.io/name=rabbitmq}"
VHOST="${1:-hotspot}"
APP_USER="${RABBITMQ_APP_USER:-hotspot}"
APP_PASS="${RABBITMQ_APP_PASS:-}"

POD="$(kubectl -n "$NAMESPACE" get pods -l "$RELEASE_LABEL" -o jsonpath='{.items[0].metadata.name}')"
if [[ -z "$POD" ]]; then
  echo "No RabbitMQ pod found in namespace '$NAMESPACE' with label '$RELEASE_LABEL'"
  exit 1
fi

if ! kubectl -n "$NAMESPACE" exec "$POD" -- rabbitmqctl list_vhosts -q | grep -Fxq "$VHOST"; then
  echo "Creating vhost '$VHOST'..."
  kubectl -n "$NAMESPACE" exec "$POD" -- rabbitmqctl add_vhost "$VHOST"
else
  echo "Vhost '$VHOST' already exists"
fi

if [[ -n "$APP_PASS" ]]; then
  if ! kubectl -n "$NAMESPACE" exec "$POD" -- rabbitmqctl list_users | awk '{print $1}' | grep -Fxq "$APP_USER"; then
    echo "Creating user '$APP_USER'..."
    kubectl -n "$NAMESPACE" exec "$POD" -- rabbitmqctl add_user "$APP_USER" "$APP_PASS"
  else
    echo "User '$APP_USER' already exists; updating password"
    kubectl -n "$NAMESPACE" exec "$POD" -- rabbitmqctl change_password "$APP_USER" "$APP_PASS"
  fi

  echo "Setting permissions for '$APP_USER' on '$VHOST'"
  kubectl -n "$NAMESPACE" exec "$POD" -- rabbitmqctl set_permissions -p "$VHOST" "$APP_USER" ".*" ".*" ".*"
else
  echo "RABBITMQ_APP_PASS not set; skipping app-user provisioning"
fi

echo "RabbitMQ vhost provisioning complete"
