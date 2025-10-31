import { useCallback, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'

import { Button } from '@repo/ui/components/button'

export const Route = createFileRoute('/debug/voice-channel/$channelId')({
  component: DebugVoiceChannel,
})

interface VoiceChannelMember {
  userId: string
  username: string
  avatar: string | null
  channelId: string | null
}

function DebugVoiceChannel() {
  const { channelId } = Route.useParams()
  const [members, setMembers] = useState<VoiceChannelMember[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getVoiceChannelMembersFn = useServerFn(async () => {
    const { getVoiceChannelMembers } = await import('@/server/discord-rooms')
    return getVoiceChannelMembers({
      data: {
        guildId: process.env.VITE_DISCORD_GUILD_ID || '',
        channelId,
      },
    })
  })

  const handleFetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getVoiceChannelMembersFn()
      setMembers(result.members || [])
      console.log('Voice channel members:', result.members)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Failed to fetch members:', err)
    } finally {
      setLoading(false)
    }
  }, [getVoiceChannelMembersFn])

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
        <h2 className="mb-4 text-xl font-bold">Members ({members.length})</h2>

        {members.length === 0 ? (
          <p className="text-slate-400">No members in voice channel</p>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.userId}
                className="flex items-center gap-3 rounded bg-slate-700 p-3"
              >
                {member.avatar && (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${member.userId}/${member.avatar}.png`}
                    alt={member.username}
                    className="h-8 w-8 rounded-full"
                  />
                )}
                <div>
                  <p className="font-bold">{member.username}</p>
                  <p className="text-sm text-slate-400">{member.userId}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 rounded bg-slate-800 p-4">
        <h2 className="mb-2 text-xl font-bold">Raw JSON</h2>
        <pre className="overflow-auto rounded bg-slate-900 p-3 text-sm">
          {JSON.stringify(members, null, 2)}
        </pre>
      </div>
    </div>
  )
}
