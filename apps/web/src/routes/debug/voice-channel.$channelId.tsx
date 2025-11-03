import { useCallback, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { Button } from '@repo/ui/components/button'

export const Route = createFileRoute('/debug/voice-channel/$channelId')({
  component: DebugVoiceChannel,
})

function DebugVoiceChannel() {
  const { channelId } = Route.useParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // TODO: Implement getVoiceChannelMembers server function
  // const getVoiceChannelMembersFn = useServerFn(async () => {
  //   const { getVoiceChannelMembers } = await import(
  //     '@/server/handlers/discord-rooms.server'
  //   )
  //   return getVoiceChannelMembers({
  //     data: {
  //       guildId: process.env.VITE_DISCORD_GUILD_ID || '',
  //       channelId,
  //     },
  //   })
  // })

  const handleFetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // TODO: Implement getVoiceChannelMembers server function
      // const result = await getVoiceChannelMembersFn()
      // setMembers(result.members || [])
      // console.log('Voice channel members:', result.members)
      setError('Not implemented')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Failed to fetch members:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void handleFetch()
  }, [channelId, handleFetch])

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-white">
      <h1 className="mb-4 text-3xl font-bold">Debug: Voice Channel Members</h1>
      <p className="mb-4 text-slate-400">Channel ID: {channelId}</p>

      <Button onClick={handleFetch} disabled={loading} className="mb-4">
        {loading ? 'Loading...' : 'Fetch Members'}
      </Button>

      {error && (
        <div className="mb-4 rounded bg-red-900 p-4 text-red-100">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      <div className="rounded bg-slate-800 p-4">
        <h2 className="mb-4 text-xl font-bold">Members</h2>
        <p className="text-slate-400">
          Not implemented - server function needs to be created
        </p>
      </div>
    </div>
  )
}
