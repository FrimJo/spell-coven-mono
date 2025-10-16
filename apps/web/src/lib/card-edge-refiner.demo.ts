/**
 * Demo: How to use OpenCV edge refinement with webcam card detection
 *
 * This shows how to integrate the edge refinement feature into your application
 */

import { loadOpenCV } from './card-edge-refiner'
import { setupWebcam } from './webcam'

/**
 * Example: Setup webcam with edge refinement enabled
 */
export async function setupWebcamWithEdgeRefinement() {
  // Get DOM elements
  const video = document.getElementById('video') as HTMLVideoElement
  const overlay = document.getElementById('overlay') as HTMLCanvasElement
  const cropped = document.getElementById('cropped') as HTMLCanvasElement
  const fullRes = document.getElementById('fullRes') as HTMLCanvasElement

  // Load OpenCV.js (this may take a few seconds)
  try {
    await loadOpenCV()
  } catch (err) {
    console.error('Failed to load OpenCV:', err)
    // Continue without edge refinement
  }

  // Setup webcam
  const webcam = await setupWebcam({
    video,
    overlay,
    cropped,
    fullRes,
    detectorType: 'detr', // or 'owl-vit'
    onCrop: (canvas) => {
      // Do something with the cropped card
      // e.g., send to embedding API, display in UI, etc.
    },
    onProgress: (msg) => {},
  })

  // Enable edge refinement if OpenCV is available
  if (webcam.isEdgeRefinementAvailable()) {
    webcam.setEdgeRefinement(true)
  } else {
    console.warn('OpenCV not available, edge refinement disabled')
  }

  // Start video
  await webcam.startVideo()

  return webcam
}

/**
 * Example: Toggle edge refinement on/off
 */
export function createEdgeRefinementToggle(
  webcam: Awaited<ReturnType<typeof setupWebcam>>,
) {
  const toggleButton = document.createElement('button')
  toggleButton.textContent = 'Toggle Edge Refinement'

  toggleButton.addEventListener('click', () => {
    if (!webcam.isEdgeRefinementAvailable()) {
      alert('OpenCV not loaded. Edge refinement unavailable.')
      return
    }

    const currentState = webcam.isEdgeRefinementEnabled()
    webcam.setEdgeRefinement(!currentState)

    toggleButton.textContent = `Edge Refinement: ${!currentState ? 'ON' : 'OFF'}`
  })

  return toggleButton
}

/**
 * Example: Standalone edge refinement (without webcam)
 * Useful for refining already-captured card images
 */
export async function refineExistingCardImage(
  imageUrl: string,
): Promise<HTMLCanvasElement | null> {
  const { loadOpenCV, refineCardEdgesWithAutoLoad } = await import(
    './card-edge-refiner'
  )

  // Load OpenCV if needed
  await loadOpenCV()

  // Load image into canvas
  const img = new Image()
  img.src = imageUrl
  await new Promise((resolve) => {
    img.onload = resolve
  })

  const inputCanvas = document.createElement('canvas')
  inputCanvas.width = img.width
  inputCanvas.height = img.height
  const ctx = inputCanvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)

  // Refine edges
  const result = await refineCardEdgesWithAutoLoad(inputCanvas, 384, 384)

  if (result.success) {
    return result.refinedCanvas!
  } else {
    console.error('Edge refinement failed:', result.error)
    return null
  }
}
