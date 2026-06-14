# Sentry Observability

This repo ships with production-grade Sentry instrumentation for the Convex backend and the web
client. The integration includes error tracking, performance tracing, release tracking, environment
separation, session replay, source maps upload, and data scrubbing.

Shared data-scrubbing policy lives in `@repo/observability`. Both the web app and Convex backend
import the same `sanitizeSentryData` and sensitive-key rules from that package; web code should not
import observability helpers from `convex/`.

## Environment variables

### Required (all environments)

| Variable                  | Description                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `VITE_SENTRY_DSN`         | Browser-exposed Sentry DSN used by the web client.                                        |
| `SENTRY_DSN`              | Sentry DSN used by the Convex backend.                                                    |
| `VITE_SENTRY_ENVIRONMENT` | Browser environment name (`development`, `staging`, `production`). Defaults to Vite mode. |
| `SENTRY_ENVIRONMENT`      | Convex environment name. Defaults to the Convex deployment URL when unset.                |
| `VITE_SENTRY_RELEASE`     | Release identifier shared across backend and frontend (use git SHA or CI build number).   |

### Optional tuning

| Variable                                 | Description                                | Default                                 |
| ---------------------------------------- | ------------------------------------------ | --------------------------------------- |
| `VITE_SENTRY_TRACES_SAMPLE_RATE`         | Web tracing sample rate.                   | `1` in development, `0.2` in production |
| `VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE` | Web session replay sampling in production. | `0.05`                                  |
| `VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE`   | Web replay sampling for error sessions.    | `1`                                     |

### CI-only (source maps)

| Variable              | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| `SENTRY_AUTH_TOKEN`   | Auth token used by the Sentry Vite plugin for source map upload. |
| `VITE_SENTRY_ORG`     | Sentry org slug.                                                 |
| `VITE_SENTRY_PROJECT` | Sentry project slug for the web client.                          |

## Local setup

1. Add the required variables to `.env.development.local`:

   ```bash
   VITE_SENTRY_DSN=...
   SENTRY_DSN=...
   VITE_SENTRY_ENVIRONMENT=development
   SENTRY_ENVIRONMENT=development
   VITE_SENTRY_RELEASE=local-dev
   ```

2. Start Convex and the web app as usual. The web client initializes when `VITE_SENTRY_DSN` is
   present; Convex reporting initializes when `SENTRY_DSN` is present.

## CI setup for source maps

The web build uses `@sentry/vite-plugin` to upload source maps when the CI environment provides
`SENTRY_AUTH_TOKEN`, `VITE_SENTRY_ORG`, and `VITE_SENTRY_PROJECT`.

Recommended steps in your CI workflow:

1. Export release metadata (shared across backend + web):

   ```bash
   export VITE_SENTRY_RELEASE=${VITE_GITHUB_SHA}
   export VITE_SENTRY_ENVIRONMENT=production
   export SENTRY_ENVIRONMENT=production
   ```

2. Ensure the Sentry auth variables are present for the web build:

   ```bash
   export SENTRY_AUTH_TOKEN=...
   export VITE_SENTRY_ORG=your-org
   export VITE_SENTRY_PROJECT=spell-coven-web
   ```

3. Run the web build (`bun run build` in `apps/web`). The plugin uploads the source maps.

## Test hooks

### Web

Navigate to `/debug/sentry` in development to trigger:

- A thrown error (captured automatically)
- A captured exception
- A captured message

In production, `/debug/sentry` renders the normal app not-found experience.

### Convex

Use the `sentryDebug.triggerSentryError` mutation (development only). It supports:

- `{ mode: "message" }` to capture a backend message.
- `{ mode: "exception" }` or no args to capture and throw a backend exception.

Convex functions should use `sentryQuery`, `sentryMutation`, `sentryInternalMutation`, or
`sentryAction` instead of local `try`/`catch` reporting. Handlers receive a scoped `sentry`
argument for breadcrumbs; those breadcrumbs are attached to unexpected Sentry events from the same
invocation. Expected domain errors remain non-error states and are not sent to Sentry.

Browser hooks, adapters, and operation helpers own operational exception reporting; UI components
should keep user-facing state, toasts, and dialogs out of Sentry capture policy.

## Alerting recommendations

Create Sentry alerts for:

- **Error rate spikes**: trigger when error count > baseline for 5–10 minutes.
- **Slow transactions**: notify when p95 transaction duration exceeds 2–3 seconds.
- **New issue detection**: alert on first occurrence of a new issue in production.

## Verification checklist

- [ ] Confirm `VITE_SENTRY_DSN`, `SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`, `SENTRY_ENVIRONMENT`, and `VITE_SENTRY_RELEASE` are set in local dev.
- [ ] Trigger `/debug/sentry` and verify events in the Sentry project.
- [ ] Call `triggerSentryError` in Convex to verify backend ingestion.
- [ ] Validate release tags match across backend and web.
- [ ] Run a web build in CI and verify source maps upload in Sentry.
