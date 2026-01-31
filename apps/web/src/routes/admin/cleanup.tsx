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
  const [result, setResult] = useState<ChannelsResult | null>(null)
  const loading = false

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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">
          Admin Channel Cleanup
        </h1>
        <p className="mb-8 text-gray-600">
          Remove all voice channels created by the Spell Coven app
        </p>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
          {/* Secret Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700">
              Admin Secret
            </label>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter ADMIN_CLEANUP_SECRET"
              className="mt-2 w-full rounded border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="mb-6 flex gap-4">
            <button
              onClick={handleList}
              disabled={loading}
              className="flex-1 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading && result?.type === 'list'
                ? 'Loading...'
                : 'List Channels'}
            </button>
            <button
              onClick={handleCleanup}
              disabled={loading}
              className="flex-1 rounded bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:bg-gray-400"
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
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              }`}
            >
              <h2 className="mb-4 font-semibold text-gray-900">
                {result.type === 'list' ? 'Channel List' : 'Cleanup Result'}
              </h2>

              {result.error && (
                <div className="mb-4 rounded bg-red-100 p-3 text-red-800">
                  <p className="font-medium">Error:</p>
                  <p>{result.error}</p>
                </div>
              )}

              {/* Success cases removed - functionality disabled */}
            </div>
          )}

          {/* Info Box */}
          <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="mb-2 font-semibold text-blue-900">How it works:</h3>
            <ul className="space-y-1 text-sm text-blue-800">
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
