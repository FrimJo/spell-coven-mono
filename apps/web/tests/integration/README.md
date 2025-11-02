# Realtime Gateway Integration Tests

Integration harnesses that exercise the realtime data path end-to-end land here. Each spec boots the TanStack Start server test
fixture, injects mocked Discord gateway frames, and asserts behaviour at the `/api/stream` SSE endpoint or legacy WebSocket
bridge.

## Running the tests

Execute the integration suite with:

```sh
pnpm --filter @repo/web test -- --run tests/integration
```

Tests in this directory coordinate closely with the Vitest server suites; keep mock gateway contracts in sync with
`packages/discord-gateway` when adding new scenarios.
