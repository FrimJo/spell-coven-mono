# Quickstart: Discord Gateway Realtime Communications Platform

1. **Install dependencies**
   ```bash
   pnpm install
   pnpm --filter @repo/web build
   ```

2. **Set required environment variables**
   - `GATEWAY_WS_URL` → wss endpoint exposed by gateway service
   - `LINK_TOKEN` → shared bearer token for Start ↔ Gateway authentication
   - `HUB_SECRET` → existing HMAC secret for `/api/internal/events` fallback
   - `VITE_DISCORD_GUILD_ID` → guild scope used by legacy voice bridge

3. **Run TanStack Start dev server**
   ```bash
   pnpm --filter @repo/web dev
   ```
   - This starts the Start server, initializes the `GatewayWsClient`, and exposes `/api/stream` SSE.

4. **Verify SSE stream**
   ```bash
   curl -H "Authorization: Bearer <session-token>" \
        -N http://localhost:3000/api/stream
   ```
   - Expect `: ping` heartbeats every 15 s and JSON events when the gateway pushes frames.

5. **Send a test command**
   ```bash
   curl -X POST http://localhost:3000/api/send-message \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer <session-token>" \
        -d '{"channelId":"123","content":"Hello Gateway"}'
   ```
   - Response should be `{ "ok": true }` when rate limits permit.

6. **Observe logs & metrics**
   - Server logs include `traceId`, command type, and latency.
   - Metrics published via `gateway-metrics.ts` feed existing observability pipeline.

7. **Legacy bridge toggle**
   - Set feature flag `ENABLE_WS_BRIDGE=true` (e.g., via environment) to keep `/api/ws` active while migrating hooks.
   - Disable after confirming React hooks consume SSE directly.
