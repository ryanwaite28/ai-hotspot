#!/usr/bin/env bash
set -euo pipefail

: "${CI_REGISTRY:?CI_REGISTRY is required}"
: "${CI_REGISTRY_IMAGE:?CI_REGISTRY_IMAGE is required}"
: "${CI_REGISTRY_USER:?CI_REGISTRY_USER is required}"
: "${CI_REGISTRY_PASSWORD:?CI_REGISTRY_PASSWORD is required}"
: "${CI_COMMIT_SHORT_SHA:?CI_COMMIT_SHORT_SHA is required}"

cat > /kaniko/.docker/config.json <<EOF
{"auths":{"$CI_REGISTRY":{"username":"$CI_REGISTRY_USER","password":"$CI_REGISTRY_PASSWORD"}}}
EOF

/kaniko/executor \
  --context "$CI_PROJECT_DIR" \
  --dockerfile "$CI_PROJECT_DIR/Dockerfile" \
  --destination "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA" \
  --destination "$CI_REGISTRY_IMAGE:build-$CI_PIPELINE_ID"
