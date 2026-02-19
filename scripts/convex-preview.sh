#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-build}"

case "$MODE" in
  build|e2e|e2e-ui|e2e:torture|e2e:visual-update)
    ;;
  *)
    echo "Unsupported mode: $MODE (expected: build | e2e | e2e-ui | e2e:torture | e2e:visual-update)" >&2
    exit 2
    ;;
esac

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
  echo "Could not derive preview name. Set one of: CONVEX_PREVIEW_NAME, VERCEL_GIT_COMMIT_REF, GITHUB_HEAD_REF, GITHUB_REF_NAME, VERCEL_GIT_COMMIT_SHA, GITHUB_SHA" >&2
  exit 1
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
export PREVIEW_LOGIN_CODE

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

DEPLOY_CMD='bun run build'

# Ensure the same preview login code is available to the local --cmd process
# executed by `convex deploy`.
DEPLOY_CMD="PREVIEW_LOGIN_CODE=$PREVIEW_LOGIN_CODE $DEPLOY_CMD"
# Write .convex_url.gen with the raw URL so e2e can reuse VITE_CONVEX_URL.
DEPLOY_CMD="$DEPLOY_CMD && printf '%s\n' \"\$VITE_CONVEX_URL\" > .convex_url.gen"

deploy_args=(
  --preview-create "$PREVIEW_NAME"
  --cmd "$DEPLOY_CMD"
  --cmd-url-env-var-name VITE_CONVEX_URL
)

bunx convex deploy "${deploy_args[@]}"

# E2E_TEST is expected from Convex Dashboard defaults.
bunx convex env set --preview-name "$PREVIEW_NAME" PREVIEW_LOGIN_CODE "$PREVIEW_LOGIN_CODE"

# Load preview URL into this shell so e2e steps can use VITE_CONVEX_URL.
[ -f .convex_url.gen ] && export VITE_CONVEX_URL="$(cat .convex_url.gen)"

case "$MODE" in
  e2e)
    (cd apps/web && PREVIEW_LOGIN_CODE=$PREVIEW_LOGIN_CODE bun run e2e)
    ;;
  e2e-ui)
    (cd apps/web && PREVIEW_LOGIN_CODE=$PREVIEW_LOGIN_CODE bun run e2e:ui)
    ;;
  e2e:torture)
    (cd apps/web && PREVIEW_LOGIN_CODE=$PREVIEW_LOGIN_CODE bun run e2e:torture)
    ;;
  e2e:visual-update)
    (cd apps/web && PREVIEW_LOGIN_CODE=$PREVIEW_LOGIN_CODE bun run e2e:visual:update)
    ;;
esac
