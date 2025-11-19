/**
 * Type extensions for DOM APIs that exist at runtime but aren't in TypeScript's DOM types
 */

/**
 * Extension for HTMLAudioElement and HTMLVideoElement to include setSinkId()
 *
 * setSinkId() is part of the Media Capture and Streams API and allows selecting
 * the audio output device (speakers/headphones) for media elements.
 *
 * Browser Support:
 * - Chrome/Edge: Full support
 * - Firefox: Supported (may require flag in older versions)
 * - Safari: NOT supported as of 2024
 *
 * Fallback Behavior:
 * In browsers without setSinkId() support, audio will play to the system
 * default output device. Always check for support using:
 * ```typescript
 * if ('setSinkId' in audioElement) {
 *   await audioElement.setSinkId(deviceId)
 * }
 * ```
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/setSinkId
 */
interface HTMLMediaElement {
  /**
   * Sets the ID of the audio device to use for output.
   * @param deviceId The device ID from MediaDeviceInfo.deviceId, or 'default' for system default
   * @returns Promise that resolves when the device is set
   */
  setSinkId(deviceId: string): Promise<void>
}
