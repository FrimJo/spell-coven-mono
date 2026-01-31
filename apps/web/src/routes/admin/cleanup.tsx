import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

// Admin cleanup functionality removed - server-side code no longer exists
// This route is kept for reference but functionality is disabled

export const Route = createFileRoute('/admin/cleanup')({
  component: AdminCleanup,
})

type ChannelsResult = {
  type: 'cleanup' | 'list'
  error: string
  success: false
}

function AdminCleanup() {
  const [secret, setSecret] = useState('')
  const [loading] = useState(false)
  const [result, setResult] = useState<ChannelsResult | null>(null)

  const handleList = async () => {
    setResult({
      type: 'list',
      success: false,
      error:
        'Admin cleanup functionality has been removed. Server-side code no longer exists.',
    })
  }

  const handleCleanup = async () => {
    setResult({
      type: 'cleanup',
      success: false,
      error:
        'Admin cleanup functionality has been removed. Server-side code no longer exists.',
    })
  }

  return (
    <div className="min-h-screen bg-surface-0 p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-3xl font-bold text-white">
          Admin Channel Cleanup
        </h1>
        <p className="mb-8 text-muted">
          Remove all voice channels created by the Spell Coven app
        </p>

        <div className="rounded-lg border border-surface-2 bg-surface-1 p-6 shadow">
          {/* Secret Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-secondary">
              Admin Secret
            </label>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter ADMIN_CLEANUP_SECRET"
              className="mt-2 w-full rounded border border-surface-2 bg-surface-0 px-3 py-2 text-white placeholder-muted focus:border-info focus:outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="mb-6 flex gap-4">
            <button
              onClick={handleList}
              disabled={loading}
              className="flex-1 rounded bg-info px-4 py-2 font-medium text-white hover:bg-info/90 disabled:bg-surface-3"
            >
              {loading && result?.type === 'list'
                ? 'Loading...'
                : 'List Channels'}
            </button>
            <button
              onClick={handleCleanup}
              disabled={loading}
              className="flex-1 rounded bg-destructive px-4 py-2 font-medium text-white hover:bg-destructive/90 disabled:bg-surface-3"
            >
              {loading && result?.type === 'cleanup'
                ? 'Deleting...'
                : 'Delete All Channels'}
            </button>
          </div>

          {/* Results */}
          {result && (
            <div
              className={`rounded-lg border p-4 ${
                result.success
                  ? 'border-success/50 bg-success/10'
                  : 'border-destructive/50 bg-destructive/10'
              }`}
            >
              <h2 className="mb-4 font-semibold text-white">
                {result.type === 'list' ? 'Channel List' : 'Cleanup Result'}
              </h2>

              {result.error && (
                <div className="mb-4 rounded bg-destructive/20 p-3 text-destructive">
                  <p className="font-medium">Error:</p>
                  <p>{result.error}</p>
                </div>
              )}

              {/* Success cases removed - functionality disabled */}
            </div>
          )}

          {/* Info Box */}
          <div className="mt-8 rounded-lg border border-info/50 bg-info/10 p-4">
            <h3 className="mb-2 font-semibold text-info">How it works:</h3>
            <ul className="space-y-1 text-sm text-info">
              <li>✓ Only removes voice channels with permission overwrites</li>
              <li>✓ Leaves all other channels untouched</li>
              <li>
                ✓ Use &quot;List Channels&quot; to preview before deleting
              </li>
              <li>✓ All deletions are logged for audit trail</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
