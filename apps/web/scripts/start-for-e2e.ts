/**
 * Starts Convex (background) then the frontend dev server (foreground).
 * Used by Playwright webServer so it only waits for the frontend URL.
 */
import { connect } from 'net'
import { resolve } from 'path'

const REPO_ROOT = resolve(import.meta.dir, '../../..')
const CONVEX_PORT = 3210
const PORT_WAIT_MS = 90_000
const PORT_POLL_MS = 500

function waitForPort(port: number): Promise<void> {
  const start = Date.now()
  return new Promise((resolvePort, reject) => {
    const tryConnect = () => {
      if (Date.now() - start > PORT_WAIT_MS) {
        reject(new Error(`Port ${port} did not open within ${PORT_WAIT_MS}ms`))
        return
      }
      const socket = connect(
        { port, host: '127.0.0.1', allowHalfOpen: false },
        () => {
          socket.destroy()
          resolvePort()
        },
      )
      socket.on('error', () => setTimeout(tryConnect, PORT_POLL_MS))
    }
    tryConnect()
  })
}

async function main() {
  const convex = Bun.spawn(['bun', 'run', 'convex:dev', '--', '--local'], {
    cwd: REPO_ROOT,
    env: { ...process.env, CONVEX_AUTH_TEST_MODE: 'true' },
    stdout: 'inherit',
    stderr: 'inherit',
    detached: true,
  })
  convex.unref()

  await waitForPort(CONVEX_PORT)

  // Replace this process with the dev server so Playwright can wait for its URL
  const dev = Bun.spawn(['bun', 'run', 'dev:test'], {
    cwd: resolve(import.meta.dir, '../..'),
    env: process.env,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  await dev.exited
  process.exit(dev.exitCode ?? 0)
}

main().catch((err) => {
  console.error('[start-for-e2e]', err)
  process.exit(1)
})
