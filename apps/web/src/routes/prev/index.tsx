import { useEffect, useMemo, useState } from 'react'
import { useWebcam } from '@/hooks/useWebcam'
import {
  embedFromCanvas,
  loadEmbeddingsAndMetaFromPackage,
  loadModel,
  top1,
} from '@/lib/clip-search'
import { createFileRoute } from '@tanstack/react-router'

type Result = {
  name: string
  set: string
  score: number
  scryfall_uri?: string
  image_url?: string
  card_url?: string
}

export const Route = createFileRoute('/prev/')({
  component: ScannerPage,
})

function ScannerPage() {
  const [spinnerText, setSpinnerText] = useState<string>('')
  const [spinnerVisible, setSpinnerVisible] = useState<boolean>(false)
  const [results, setResults] = useState<Result[]>([])

  const {
    videoRef,
    overlayRef,
    croppedRef,
    fullResRef,
    cameraSelectRef,
    startVideo,
    getCroppedCanvas,
    hasCroppedImage,
    status,
    isLoading,
  } = useWebcam({
    enableCardDetection: true,
    onCrop: () => {},
  })

  function setSpinner(text: string, show = true) {
    setSpinnerText(text)
    setSpinnerVisible(show)
  }

  useEffect(() => {
    let mounted = true

    async function initModel() {
      try {
        setSpinner('Loading embeddings…', true)
        await loadEmbeddingsAndMetaFromPackage()
        setSpinner('Downloading CLIP (vision) model…', true)
        await loadModel({
          onProgress: (msg) => mounted && setSpinner(msg, true),
        })
        setSpinner('', false)
      } catch (err) {
        console.error('Model initialization error:', err)
        setSpinner('', false)
      }
    }

    initModel()
    return () => {
      mounted = false
    }
  }, [])

  const handleStartCam = async () => {
    await startVideo(cameraSelectRef.current?.value || null)
  }

  const handleCameraChange: React.ChangeEventHandler<
    HTMLSelectElement
  > = async (e) => {
    await startVideo(e.target.value || null)
  }

  const handleSearchCropped = async () => {
    const canvas = getCroppedCanvas()
    if (!canvas) {
      console.error('Cropped canvas ref not available')
      return
    }

    // Check if the cropped canvas has actual image data
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      console.error('Could not get 2d context from cropped canvas')
      return
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const hasData = imageData.data.some((pixel) => pixel !== 0)

    if (!hasData) {
      console.warn('Cropped canvas is empty - please select a card first')
      return
    }

    try {
      setSpinner('Embedding cropped…', true)
      const { embedding: q } = await embedFromCanvas(canvas)
      setSpinner('Searching…', true)
      const best = top1(q)
      setResults([best as Result])
    } catch (err) {
      console.error('Embedding/search failed:', err)
      setSpinner('', false)
    } finally {
      setSpinner('', false)
    }
  }

  const resCards = useMemo(
    () =>
      results.map((r, idx) => {
        const cardUrl =
          r.card_url ||
          (r.image_url ? r.image_url.replace('/art_crop/', '/normal/') : '')
        return (
          <div
            key={idx}
            data-testid="result-item"
            style={{ margin: '0.8rem 0' }}
          >
            <b data-testid="result-name">{r.name}</b>{' '}
            <span data-testid="result-set">[{r.set}]</span>{' '}
            <span data-testid="result-score">(score {r.score.toFixed(3)})</span>
            {r.scryfall_uri ? (
              <>
                {' '}
                —{' '}
                <a
                  data-testid="scryfall-link"
                  href={r.scryfall_uri}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Scryfall
                </a>
              </>
            ) : null}
            <br />
            {cardUrl ? (
              <img
                data-testid="result-image"
                src={cardUrl}
                width={240}
                loading="lazy"
                decoding="async"
              />
            ) : null}
          </div>
        )
      }),
    [results],
  )

  return (
    <div
      data-testid="scanner-page"
      style={{
        padding: '1rem',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      }}
    >
      <h1 data-testid="page-title">MTG Card Lookup</h1>
      <p data-testid="page-description">
        Use your webcam to select a card. The model runs fully in your browser.
      </p>
      {spinnerVisible || isLoading ? (
        <div
          data-testid="spinner"
          style={{ margin: '0.8rem 0', color: '#555' }}
        >
          {spinnerText || status || 'Loading…'}
        </div>
      ) : null}
      <div data-testid="results-container">{resCards}</div>

      <hr data-testid="divider" />
      <h2 data-testid="webcam-section-title">Webcam (prototype)</h2>
      <div
        id="webcamControls"
        data-testid="webcam-controls"
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          margin: '8px 0',
          flexWrap: 'wrap',
        }}
      >
        <label htmlFor="cameraSelect" data-testid="camera-label">
          Camera:
        </label>
        <select
          id="cameraSelect"
          data-testid="camera-select"
          ref={cameraSelectRef}
          onChange={handleCameraChange}
        />
        <button
          id="startCamBtn"
          data-testid="start-webcam-btn"
          onClick={handleStartCam}
        >
          Start Webcam
        </button>
        <button
          id="searchCroppedBtn"
          data-testid="search-cropped-btn"
          onClick={handleSearchCropped}
          disabled={!hasCroppedImage}
        >
          Search Cropped
        </button>
        <span data-testid="status-text" style={{ color: '#666' }}>
          {status}
        </span>
      </div>
      <div
        className="camWrap"
        data-testid="camera-wrapper"
        style={{ position: 'relative', width: 640, height: 480 }}
      >
        <video
          id="video"
          data-testid="video-element"
          ref={videoRef}
          autoPlay
          muted
          playsInline
          width={640}
          height={480}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 640,
            height: 480,
            border: '1px solid #ccc',
            zIndex: 0,
          }}
        />
        <canvas
          id="overlay"
          data-testid="overlay-canvas"
          ref={overlayRef}
          width={640}
          height={480}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 640,
            height: 480,
            border: '1px solid #ccc',
            cursor: 'pointer',
            zIndex: 1,
          }}
        />
      </div>
      <canvas
        id="cropped"
        data-testid="cropped-canvas"
        ref={croppedRef}
        width={446}
        height={620}
        style={{
          border: '1px solid #ccc',
          width: 223,
          height: 310,
          marginTop: 8,
        }}
      />
      <canvas
        id="fullRes"
        data-testid="fullres-canvas"
        ref={fullResRef}
        width={640}
        height={480}
        style={{ display: 'none' }}
      />
    </div>
  )
}
