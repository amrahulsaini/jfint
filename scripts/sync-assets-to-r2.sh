#!/bin/bash
#
# Upload the large static assets (~450 MB) to Cloudflare R2.
#
# These directories used to live in public/ and ship with the deployment. They are
# now untracked and served from R2 instead — see lib/assets.ts. Run this on the box
# that still holds the files (the GCP VM at /home/jecrcfoundation.live/public_html/jfint).
#
# Requires the AWS CLI: apt-get install -y awscli
#
# Usage:
#   export R2_ACCOUNT_ID=...
#   export R2_ACCESS_KEY_ID=...
#   export R2_SECRET_ACCESS_KEY=...
#   export R2_BUCKET=jfint-assets
#   ./scripts/sync-assets-to-r2.sh
#
set -euo pipefail

: "${R2_ACCOUNT_ID:?set R2_ACCOUNT_ID}"
: "${R2_ACCESS_KEY_ID:?set R2_ACCESS_KEY_ID}"
: "${R2_SECRET_ACCESS_KEY:?set R2_SECRET_ACCESS_KEY}"
: "${R2_BUCKET:?set R2_BUCKET}"

ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto
# R2 does not implement the streaming checksum trailers newer AWS CLIs send by default.
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required

sync_dir() {
  local dir="$1" content_type="$2"
  if [ ! -d "$ROOT/public/$dir" ]; then
    echo "!! skipping $dir — not present at $ROOT/public/$dir"
    return
  fi
  echo "=> syncing public/$dir -> s3://$R2_BUCKET/$dir"
  aws s3 sync "$ROOT/public/$dir" "s3://$R2_BUCKET/$dir" \
    --endpoint-url "$ENDPOINT" \
    --content-type "$content_type" \
    --no-progress
}

sync_dir 1styearphotos  image/jpeg
sync_dir student_photos image/jpeg
sync_dir forms-1styear  application/pdf

echo
echo "=> done. Verify a file is publicly readable, e.g.:"
echo "   curl -I \"\$NEXT_PUBLIC_ASSET_BASE_URL/student_photos/photo_<ROLL>.jpg\""
