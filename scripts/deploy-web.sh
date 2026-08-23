#!/usr/bin/env bash
# Deploy the static app (and any infra change) via CDK: S3 upload + CloudFront invalidation.
set -euo pipefail
cd "$(dirname "$0")/../infra"
npx aws-cdk deploy Isabelle --require-approval never
