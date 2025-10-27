import { useMutation } from '@tanstack/react-query'

/**
 * Options for creating a Discord room
 */
interface CreateRoomOptions {
  name?: string
  parentId?: string
  userLimit?: number
}

/**
 * Response from creating a Discord room
 */
interface CreateRoomResponse {
  channelId: string
  name: string
  guildId: string
}

/**
 * Response from deleting a Discord room
 */
interface DeleteRoomResponse {
  ok: boolean
}

/**
 * Hook for managing Discord voice channels (rooms)
 * Uses TanStack Query mutations for optimized state management
 */
export function useDiscordRooms() {
  /**
   * Create a new Discord voice channel
   */
  const createRoomMutation = useMutation({
    mutationFn: async (options?: CreateRoomOptions): Promise<CreateRoomResponse> => {
      const response = await fetch('/api/create-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: options?.name,
          parentId: options?.parentId,
          userLimit: options?.userLimit,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to create room: ${response.status}`)
      }

      return response.json()
    },
  })

  /**
   * Delete a Discord voice channel
   */
  const deleteRoomMutation = useMutation({
    mutationFn: async (channelId: string): Promise<DeleteRoomResponse> => {
      const response = await fetch(`/api/end-room/${channelId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to delete room: ${response.status}`)
      }

      return response.json()
    },
  })

  return {
    // Create room
    createRoom: createRoomMutation.mutate,
    createRoomAsync: createRoomMutation.mutateAsync,
    isCreating: createRoomMutation.isPending,
    createError: createRoomMutation.error,
    createData: createRoomMutation.data,
    resetCreate: createRoomMutation.reset,

    // Delete room
    deleteRoom: deleteRoomMutation.mutate,
    deleteRoomAsync: deleteRoomMutation.mutateAsync,
    isDeleting: deleteRoomMutation.isPending,
    deleteError: deleteRoomMutation.error,
    deleteData: deleteRoomMutation.data,
    resetDelete: deleteRoomMutation.reset,

    // Combined error state for convenience
    error: createRoomMutation.error || deleteRoomMutation.error,
  }
}
