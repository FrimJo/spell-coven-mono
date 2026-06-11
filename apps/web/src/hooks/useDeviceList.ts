/**
 * useDeviceList - Labeled device list for a single device kind.
 *
 * Enumerates devices (via the cached `useEnumeratedMediaDevices` query) and
 * applies human-readable label fallbacks, WITHOUT acquiring a MediaStream.
 * Use this for device pickers. Reach for `useMediaDevice` only when you also
 * need to capture a stream.
 */
import { useMemo } from 'react'

import { useEnumeratedMediaDevices } from './useEnumeratedMediaDevices'

export function useDeviceList(
  kind: MediaDeviceInfo['kind'],
): MediaDeviceInfo[] {
  const { data: mediaDevicesByKind } = useEnumeratedMediaDevices()

  return useMemo(
    () =>
      mediaDevicesByKind[kind].map((device, index) => ({
        deviceId: device.deviceId,
        groupId: device.groupId,
        kind: device.kind,
        label:
          device.label ||
          `${kind === 'videoinput' ? 'Camera' : 'Microphone'} ${index + 1}`,
        toJSON: device.toJSON,
      })),
    [kind, mediaDevicesByKind],
  )
}
