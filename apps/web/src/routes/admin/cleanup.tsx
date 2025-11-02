import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import {
  cleanupAppChannels,
  CleanupResult,
  listAppChannels,
  ListResult,
} from '../../server/handlers/admin-cleanup.server'

export const Route = createFileRoute('/admin/cleanup')({
  component: AdminCleanup,
})

type ChannelsReult= (CleanupResult & {type: 'cleanup'}) | (ListResult & {type: 'list'}) | ({type: 'cleanup' | 'list', error: string, success: false})

function AdminCleanup() {
  const [secret, setSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ChannelsReult | null>(null)


  const listChannels = useServerFn(listAppChannels)
  const cleanup = useServerFn(cleanupAppChannels)

  const handleList = async () => {
    if (!secret.trim()) {
      setResult(null)
      return
    }

    setLoading(true)
    try {
      const response = await listChannels({ data: { secret } })
      setResult({
        type: 'list',
        ...response
      })
    } catch (error) {
      setResult({
        type: 'list',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCleanup = async () => {
    if (!secret.trim()) {
      setResult({
        type: 'cleanup',
        success: false,
        error: 'Please enter admin secret',
      })
      return
    }

    if (
      !confirm(
        'Are you sure you want to delete all app-created channels? This cannot be undone.',
      )
    ) {
      return
    }

    setLoading(true)
    try {
      const response = await cleanup({ data: { secret } })
      setResult({
        type: 'cleanup',
        ...response
      })
    } catch (error) {
      setResult({
        type: 'cleanup',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
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
              {loading && result?.type === 'list' ? 'Loading...' : 'List Channels'}
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

              {result.type === 'list' && result.success && (
                <div>
                  <p className="mb-4 text-gray-700">
                    Found{' '}
                    <span className="font-bold">
                      {result.channels.length}
                    </span>{' '}
                    app-created channels:
                  </p>
                  {result.channels.length > 0 ? (
                    <div className="space-y-2">
                      {result.channels.map(
                        (
                          channel: {
                            id: string
                            name: string
                            userLimit?: number
                            permissionOverwriteCount: number
                          },
                          idx: number,
                        ) => (
                          <div
                            key={channel.id}
                            className="rounded bg-white p-3 text-sm"
                          >
                            <div className="font-medium text-gray-900">
                              {idx + 1}. {channel.name}
                            </div>
                            <div className="mt-1 text-gray-600">
                              <div>ID: {channel.id}</div>
                              {channel.userLimit && (
                                <div>User Limit: {channel.userLimit}</div>
                              )}
                              <div>
                                Permission Overwrites:{' '}
                                {channel.permissionOverwriteCount}
                              </div>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-600">No app-created channels found</p>
                  )}
                </div>
              )}

              {result.type === 'cleanup' && result.success && (
                <div>
                  <p className="mb-4 text-gray-700">
                    Successfully deleted{' '}
                    <span className="font-bold">
                      {result.deletedChannels.length}
                    </span>{' '}
                    channels:
                  </p>
                  {result.deletedChannels.length > 0 ? (
                    <div className="space-y-2">
                      {result.deletedChannels.map(
                        (
                          channel: { id: string; name: string },
                          idx: number,
                        ) => (
                          <div
                            key={channel.id}
                            className="rounded bg-white p-3 text-sm"
                          >
                            <div className="font-medium text-gray-900">
                              {idx + 1}. {channel.name}
                            </div>
                            <div className="text-gray-600">ID: {channel.id}</div>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-600">No channels were deleted</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Info Box */}
          <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="mb-2 font-semibold text-blue-900">How it works:</h3>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>
                ✓ Only removes voice channels with permission overwrites
              </li>
              <li>✓ Leaves all other channels untouched</li>
              <li>✓ Use &quot;List Channels&quot; to preview before deleting</li>
              <li>✓ All deletions are logged for audit trail</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
