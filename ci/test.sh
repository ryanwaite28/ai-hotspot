#!/usr/bin/env bash
set -euo pipefail

npm ci || npm install
npm run test
npm run test:integration
