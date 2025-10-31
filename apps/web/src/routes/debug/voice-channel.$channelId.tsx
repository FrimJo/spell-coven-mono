import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useCallback, useEffect, useState } from 'react'
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
    <div className="p-8 bg-slate-950 min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-4">Debug: Voice Channel Members</h1>
      <p className="text-slate-400 mb-4">Channel ID: {channelId}</p>

      <Button onClick={handleFetch} disabled={loading} className="mb-4">
        {loading ? 'Loading...' : 'Fetch Members'}
      </Button>

      {error && (
        <div className="bg-red-900 text-red-100 p-4 rounded mb-4">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      <div className="bg-slate-800 rounded p-4">
        <h2 className="text-xl font-bold mb-4">
          Members ({members.length})
        </h2>

        {members.length === 0 ? (
          <p className="text-slate-400">No members in voice channel</p>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.userId}
                className="bg-slate-700 p-3 rounded flex items-center gap-3"
              >
                {member.avatar && (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${member.userId}/${member.avatar}.png`}
                    alt={member.username}
                    className="w-8 h-8 rounded-full"
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

      <div className="mt-8 bg-slate-800 rounded p-4">
        <h2 className="text-xl font-bold mb-2">Raw JSON</h2>
        <pre className="bg-slate-900 p-3 rounded text-sm overflow-auto">
          {JSON.stringify(members, null, 2)}
        </pre>
      </div>
    </div>
  )
}
