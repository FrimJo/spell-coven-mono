import { useEffect } from 'react'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'

export interface MediaDevicesByKind {
  audioinput: MediaDeviceInfo[]
  audiooutput: MediaDeviceInfo[]
  videoinput: MediaDeviceInfo[]
}

export const useEnumeratedMediaDevices = () => {
  const queryClient = useQueryClient()

  // Use React Query to cache device enumeration and prevent infinite re-renders
  // React's use() hook requires a stable promise reference from outside (like server components)
  // Creating promises in useMemo doesn't provide the stability needed for use()
  const mediaDevicesByKindQuery = useSuspenseQuery<MediaDevicesByKind>({
    queryKey: ['MediaDevices'],
    queryFn: async () => {
      const devices = await navigator.mediaDevices.enumerateDevices()

      // Filter out devices with empty deviceId
      const filteredDevices = devices.filter(
        (device: MediaDeviceInfo) => device.deviceId !== '',
      )

      // Group devices by kind
      const devicesByKind = Object.groupBy(
        filteredDevices,
        (device: MediaDeviceInfo) => device.kind as MediaDeviceKind,
      ) as unknown as Record<MediaDeviceKind, MediaDeviceInfo[]>

      const result: MediaDevicesByKind = {
        audioinput: devicesByKind['audioinput'] ?? [],
        audiooutput: devicesByKind['audiooutput'] ?? [],
        videoinput: devicesByKind['videoinput'] ?? [],
      }

      // For each kind group, filter out devices sharing groupId with default devices
      for (const [unknownKind, kindDevices] of Object.entries(result)) {
        const kind = unknownKind as MediaDeviceKind
        // Find all default devices in this kind group
        const defaultDevices = kindDevices.filter((device: MediaDeviceInfo) => {
          return device.deviceId === 'default'
        })

        // Collect all groupIds from default devices
        const defaultGroupIds = new Set(
          defaultDevices.map((device: MediaDeviceInfo) => device.groupId),
        )

        // Filter out devices that share groupId with any default device
        // but keep the default devices themselves
        const filteredKindDevices = kindDevices.filter(
          (device: MediaDeviceInfo) =>
            !defaultGroupIds.has(device.groupId) ||
            device.deviceId === 'default',
        )

        result[kind] = filteredKindDevices
      }

      return result
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: true, // Re-enumerate when window regains focus (devices may have changed)
  })

  useEffect(() => {
    const handleDeviceChange = () => {
      queryClient.invalidateQueries({ queryKey: ['MediaDevices'] })
    }

    window.addEventListener('devicechange', handleDeviceChange)

    return () => {
      window.removeEventListener('devicechange', handleDeviceChange)
    }
  }, [queryClient])

  return mediaDevicesByKindQuery
}
