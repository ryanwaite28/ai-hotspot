#!/usr/bin/env bash
set -euo pipefail

: "${STRIPE_WEBHOOK_FORWARD_URL:=http://api.hotspot.local/v1/stripe/webhooks}"

stripe listen --forward-to "$STRIPE_WEBHOOK_FORWARD_URL"
