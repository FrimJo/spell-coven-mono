# Realtime Gateway Server Tests

Vitest unit suites covering the realtime gateway primitives live in this directory. Target modules include the `GatewayWsClient`,
in-memory `EventBus`, command queue, rate limiter, and metrics emitters under `apps/web/src/server/gateway`.

## Running the tests

Use the web package filter to execute just the server suites:

```sh
pnpm --filter @repo/web test -- --run tests/server
```

These tests rely exclusively on in-memory fakes and do not require a running Discord gateway instance.
