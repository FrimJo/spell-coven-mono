import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/debug/session-storage')({
  component: DebugSessionStorage,
})

function DebugSessionStorage() {
  const gameState = sessionStorage.loadGameState?.()
  const creatorInviteState = sessionStorage.loadCreatorInviteState?.()

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-white">
      <h1 className="mb-4 text-3xl font-bold">Debug: Session Storage</h1>

      <div className="space-y-6">
        <div className="rounded bg-slate-800 p-4">
          <h2 className="mb-2 text-xl font-bold">Game State</h2>
          <pre className="overflow-auto rounded bg-slate-900 p-3 text-sm">
            {JSON.stringify(gameState, null, 2) || 'null'}
          </pre>
        </div>

        <div className="rounded bg-slate-800 p-4">
          <h2 className="mb-2 text-xl font-bold">Creator Invite State</h2>
          <pre className="overflow-auto rounded bg-slate-900 p-3 text-sm">
            {JSON.stringify(creatorInviteState, null, 2) || 'null'}
          </pre>
        </div>

        <div className="rounded bg-slate-800 p-4">
          <h2 className="mb-2 text-xl font-bold">Raw sessionStorage</h2>
          <pre className="overflow-auto rounded bg-slate-900 p-3 text-sm">
            {JSON.stringify(
              Object.fromEntries(
                Object.keys(sessionStorage).map((key) => [
                  key,
                  sessionStorage.getItem(key),
                ]),
              ),
              null,
              2,
            )}
          </pre>
        </div>
      </div>
    </div>
  )
}
