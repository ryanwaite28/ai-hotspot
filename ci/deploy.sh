#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-}"
if [[ -z "$ENVIRONMENT" ]]; then
  echo "Usage: $0 <dev|prod>"
  exit 1
fi

case "$ENVIRONMENT" in
  dev)
    NAMESPACE="hotspot-dev"
    ;;
  prod)
    NAMESPACE="hotspot"
    ;;
  *)
    echo "Invalid environment: $ENVIRONMENT"
    exit 1
    ;;
esac

: "${K8S_API_SERVER:?K8S_API_SERVER is required}"
: "${DEPLOY_SA_TOKEN:?DEPLOY_SA_TOKEN is required}"
: "${CI_REGISTRY_IMAGE:?CI_REGISTRY_IMAGE is required}"
: "${CI_COMMIT_SHORT_SHA:?CI_COMMIT_SHORT_SHA is required}"

if [[ -n "${K8S_CA_PEM_B64:-}" ]]; then
  echo "$K8S_CA_PEM_B64" | base64 -d > /tmp/k8s-ca.crt
  kubectl config set-cluster k3s --server="$K8S_API_SERVER" --certificate-authority=/tmp/k8s-ca.crt
else
  echo "Warning: K8S_CA_PEM_B64 not set, using insecure TLS skip verify"
  kubectl config set-cluster k3s --server="$K8S_API_SERVER" --insecure-skip-tls-verify=true
fi
kubectl config set-credentials ci --token="$DEPLOY_SA_TOKEN"
kubectl config set-context ci --cluster=k3s --user=ci --namespace="$NAMESPACE"
kubectl config use-context ci

kubectl apply -f k8s/namespace/
kubectl apply -f k8s/rbac/
kubectl apply -f k8s/services/
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/ingress/

kubectl -n "$NAMESPACE" set image deployment/hotspot-api hotspot-api="$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA" || true
kubectl -n "$NAMESPACE" rollout status deployment/hotspot-api --timeout=180s || true
