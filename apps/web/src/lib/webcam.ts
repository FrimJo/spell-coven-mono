// Port of prototype webcam + OpenCV logic to TypeScript for React/Vite
// The OpenCV.js library is loaded dynamically from the official CDN.

/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    __cvReadyPromise?: Promise<void>
    __resolveCvReady?: () => void
  }
  // OpenCV global injected by opencv.js
  // eslint-disable-next-line no-var
  var cv: any
}

function ensureOpenCVScript(): Promise<void> {
  if (window.__cvReadyPromise) return window.__cvReadyPromise

  window.__cvReadyPromise = new Promise<void>((resolve, reject) => {
    window.__resolveCvReady = resolve
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://docs.opencv.org/4.x/opencv.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load OpenCV.js'))
    document.head.appendChild(script)
  })

  return window.__cvReadyPromise
}

let overlayCtx: CanvasRenderingContext2D | null = null
let fullResCtx: CanvasRenderingContext2D | null = null
let croppedCtx: CanvasRenderingContext2D | null = null
let videoEl: HTMLVideoElement
let overlayEl: HTMLCanvasElement
let fullResCanvas: HTMLCanvasElement
let croppedCanvas: HTMLCanvasElement
let detectedCards: Array<Array<{ x: number; y: number }>> = []
const MIN_CARD_AREA = 4000
let src: any, gray: any, blurred: any, edged: any, contours: any, hierarchy: any
let animationStarted = false
let currentStream: MediaStream | null = null
let currentDeviceId: string | null = null

function orderPoints(pts: Array<{ x: number; y: number }>) {
  pts.sort((a, b) => a.x - b.x)
  const leftMost = pts.slice(0, 2)
  const rightMost = pts.slice(2, 4)
  leftMost.sort((a, b) => a.y - b.y)
  rightMost.sort((a, b) => a.y - b.y)
  return [leftMost[0], rightMost[0], rightMost[1], leftMost[1]]
}

function drawPolygon(ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>, color = 'lime', lineWidth = 3) {
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
  ctx.closePath()
  ctx.stroke()
}

function initOpenCVMats() {
  src = new cv.Mat(overlayEl.height, overlayEl.width, cv.CV_8UC4)
  gray = new cv.Mat()
  blurred = new cv.Mat()
  edged = new cv.Mat()
  contours = new cv.MatVector()
  hierarchy = new cv.Mat()
}

function detectCards() {
  overlayCtx!.clearRect(0, 0, overlayEl.width, overlayEl.height)
  detectedCards = []
  overlayCtx!.drawImage(videoEl, 0, 0, overlayEl.width, overlayEl.height)
  const imageData = overlayCtx!.getImageData(0, 0, overlayEl.width, overlayEl.height)
  src.data.set(imageData.data)
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
  cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0)
  cv.Canny(blurred, edged, 75, 200)
  cv.findContours(edged, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i)
    const approx = new cv.Mat()
    cv.approxPolyDP(contour, approx, 0.02 * cv.arcLength(contour, true), true)
    if (approx.rows === 4) {
      const area = cv.contourArea(approx)
      if (area > MIN_CARD_AREA) {
        const pts: Array<{ x: number; y: number }> = []
        for (let j = 0; j < 4; j++) {
          const p = approx.intPtr(j)
          pts.push({ x: p[0], y: p[1] })
        }
        const ordered = orderPoints(pts)
        detectedCards.push(ordered)
        drawPolygon(overlayCtx!, ordered)
      }
    }
    approx.delete()
    contour.delete()
  }
  requestAnimationFrame(detectCards)
}

function cropCardAt(x: number, y: number) {
  if (!detectedCards.length) return false
  let closestIndex = -1,
    minDist = Infinity
  for (let i = 0; i < detectedCards.length; i++) {
    const poly = detectedCards[i]
    let cx = 0,
      cy = 0
    for (const p of poly) {
      cx += p.x
      cy += p.y
    }
    cx /= poly.length
    cy /= poly.length
    const d = Math.hypot(cx - x, cy - y)
    if (d < minDist) {
      minDist = d
      closestIndex = i
    }
  }
  if (closestIndex === -1) return false
  const card = detectedCards[closestIndex]
  if (videoEl.videoWidth && videoEl.videoHeight) {
    fullResCanvas.width = videoEl.videoWidth
    fullResCanvas.height = videoEl.videoHeight
    fullResCtx!.drawImage(videoEl, 0, 0, fullResCanvas.width, fullResCanvas.height)
  }
  const scaleX = fullResCanvas.width / overlayEl.width
  const scaleY = fullResCanvas.height / overlayEl.height
  const coords = [
    card[0].x * scaleX,
    card[0].y * scaleY,
    card[1].x * scaleX,
    card[1].y * scaleY,
    card[2].x * scaleX,
    card[2].y * scaleY,
    card[3].x * scaleX,
    card[3].y * scaleY,
  ]
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, coords)
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    croppedCanvas.width,
    0,
    croppedCanvas.width,
    croppedCanvas.height,
    0,
    croppedCanvas.height,
  ])
  const M = cv.getPerspectiveTransform(srcTri, dstTri)
  const frImage = fullResCtx!.getImageData(0, 0, fullResCanvas.width, fullResCanvas.height)
  const frMat = cv.matFromImageData(frImage)
  const dst = new cv.Mat()
  cv.warpPerspective(
    frMat,
    dst,
    M,
    new cv.Size(croppedCanvas.width, croppedCanvas.height),
  )
  const imgData = new ImageData(new Uint8ClampedArray(dst.data), dst.cols, dst.rows)
  croppedCtx!.putImageData(imgData, 0, 0)
  srcTri.delete()
  dstTri.delete()
  M.delete()
  dst.delete()
  frMat.delete()
  return true
}

export async function setupWebcam(args: {
  video: HTMLVideoElement
  overlay: HTMLCanvasElement
  cropped: HTMLCanvasElement
  fullRes: HTMLCanvasElement
  onCrop?: () => void
}) {
  await ensureOpenCVScript()
  videoEl = args.video
  overlayEl = args.overlay
  croppedCanvas = args.cropped
  fullResCanvas = args.fullRes
  overlayCtx = overlayEl.getContext('2d', { willReadFrequently: true })
  fullResCtx = fullResCanvas.getContext('2d', { willReadFrequently: true })
  croppedCtx = croppedCanvas.getContext('2d')

  if (!src) initOpenCVMats()

  overlayEl.addEventListener('click', (evt) => {
    const rect = overlayEl.getBoundingClientRect()
    const x = evt.clientX - rect.left
    const y = evt.clientY - rect.top
    const ok = cropCardAt(x, y)
    if (ok && typeof args.onCrop === 'function') args.onCrop()
  })

  return {
    async startVideo(deviceId: string | null = null) {
      if (currentStream) {
        currentStream.getTracks().forEach((t) => t.stop())
        currentStream = null
      }
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { width: { ideal: 1920 }, height: { ideal: 1080 } },
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      currentStream = stream
      videoEl.srcObject = stream
      const track = stream.getVideoTracks()[0]
      const settings = (track.getSettings ? track.getSettings() : {}) as MediaTrackSettings
      currentDeviceId = settings.deviceId || deviceId || null
      return new Promise<void>((resolve) => {
        videoEl.onloadedmetadata = () => {
          void videoEl.play()
          if (!animationStarted) {
            animationStarted = true
            requestAnimationFrame(detectCards)
          }
          resolve()
        }
      })
    },
    async getCameras() {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.filter((d) => d.kind === 'videoinput')
    },
    getCurrentDeviceId() {
      return currentDeviceId
    },
    async populateCameraSelect(selectEl: HTMLSelectElement | null | undefined) {
      if (!selectEl) return
      const cams = await this.getCameras()
      const prev = selectEl.value
      selectEl.innerHTML = ''
      cams.forEach((cam, idx) => {
        const opt = document.createElement('option')
        opt.value = cam.deviceId
        opt.text = cam.label || `Camera ${idx + 1}`
        selectEl.appendChild(opt)
      })
      if (prev && Array.from(selectEl.options).some((o) => o.value === prev)) selectEl.value = prev
      else if (
        currentDeviceId &&
        Array.from(selectEl.options).some((o) => o.value === currentDeviceId)
      )
        selectEl.value = currentDeviceId
    },
    getCroppedCanvas() {
      return croppedCanvas
    },
  }
}
