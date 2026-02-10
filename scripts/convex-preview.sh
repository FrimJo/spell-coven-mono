#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-build}"

sanitize_name() {
  local raw="${1:-preview}"
  local normalized
  normalized="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')"
  if [ -z "$normalized" ]; then
    normalized="preview"
  fi
  printf '%s' "${normalized:0:48}"
}

derive_preview_name() {
  if [ -n "${CONVEX_PREVIEW_NAME:-}" ]; then
    sanitize_name "${CONVEX_PREVIEW_NAME}"
    return
  fi
  if [ -n "${PREVIEW_NAME:-}" ]; then
    sanitize_name "${PREVIEW_NAME}"
    return
  fi
  if [ -n "${VERCEL_GIT_COMMIT_REF:-}" ]; then
    sanitize_name "${VERCEL_GIT_COMMIT_REF}"
    return
  fi
  if [ -n "${GITHUB_HEAD_REF:-}" ]; then
    sanitize_name "${GITHUB_HEAD_REF}"
    return
  fi
  if [ -n "${GITHUB_REF_NAME:-}" ]; then
    sanitize_name "${GITHUB_REF_NAME}"
    return
  fi
  if [ -n "${VERCEL_GIT_COMMIT_SHA:-}" ]; then
    sanitize_name "vc-${VERCEL_GIT_COMMIT_SHA:0:12}"
    return
  fi
  if [ -n "${GITHUB_SHA:-}" ]; then
    sanitize_name "gh-${GITHUB_SHA:0:12}"
    return
  fi
  printf 'local'
}

generate_preview_login_code() {
  if [ -n "${PREVIEW_LOGIN_CODE:-}" ]; then
    printf '%s' "$PREVIEW_LOGIN_CODE"
    return
  fi
  openssl rand -base64 24 | tr -d '=+/' | cut -c1-32
}

PREVIEW_NAME="$(derive_preview_name)"
PREVIEW_LOGIN_CODE="$(generate_preview_login_code)"

if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
  echo "::add-mask::$PREVIEW_LOGIN_CODE"
fi

# Keep preview-only auth UI enabled for Vercel preview builds.
if [ -n "${VERCEL_ENV:-}" ]; then
  if [ "$VERCEL_ENV" = "preview" ]; then
    export VITE_PREVIEW_AUTH=1
  else
    export VITE_PREVIEW_AUTH=0
  fi
fi

bunx convex deploy \
  --preview-create "$PREVIEW_NAME" \
  --preview-run "seedForE2E" \
  --cmd 'bun run build' \
  --cmd-url-env-var-name VITE_CONVEX_URL

# E2E_TEST is expected from Convex Dashboard defaults.
bunx convex env set --preview-name "$PREVIEW_NAME" PREVIEW_LOGIN_CODE "$PREVIEW_LOGIN_CODE"

case "$MODE" in
  build)
    ;;
  e2e)
    PREVIEW_LOGIN_CODE="$PREVIEW_LOGIN_CODE" bash -lc 'cd apps/web && bun run e2e'
    ;;
  e2e-ui)
    PREVIEW_LOGIN_CODE="$PREVIEW_LOGIN_CODE" bash -lc 'cd apps/web && bun run e2e:ui'
    ;;
  *)
    echo "Unsupported mode: $MODE (expected: build | e2e | e2e-ui)" >&2
    exit 2
    ;;
esac
