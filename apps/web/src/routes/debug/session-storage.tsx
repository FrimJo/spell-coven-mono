import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/debug/session-storage')({
  component: DebugSessionStorage,
})

function DebugSessionStorage() {
  const gameState = sessionStorage.loadGameState?.()
  const creatorInviteState = sessionStorage.loadCreatorInviteState?.()

  return (
    <div className="p-8 bg-slate-950 min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-4">Debug: Session Storage</h1>

      <div className="space-y-6">
        <div className="bg-slate-800 rounded p-4">
          <h2 className="text-xl font-bold mb-2">Game State</h2>
          <pre className="bg-slate-900 p-3 rounded text-sm overflow-auto">
            {JSON.stringify(gameState, null, 2) || 'null'}
          </pre>
        </div>

        <div className="bg-slate-800 rounded p-4">
          <h2 className="text-xl font-bold mb-2">Creator Invite State</h2>
          <pre className="bg-slate-900 p-3 rounded text-sm overflow-auto">
            {JSON.stringify(creatorInviteState, null, 2) || 'null'}
          </pre>
        </div>

        <div className="bg-slate-800 rounded p-4">
          <h2 className="text-xl font-bold mb-2">Raw sessionStorage</h2>
          <pre className="bg-slate-900 p-3 rounded text-sm overflow-auto">
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
