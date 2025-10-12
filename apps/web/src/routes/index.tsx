import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { embedFromCanvas, loadEmbeddingsAndMetaFromPackage, loadModel, top1 } from '@/lib/search'
import { setupWebcam } from '@/lib/webcam';


type Result = { name: string; set: string; score: number; scryfall_uri?: string; image_url?: string; card_url?: string }

export const Route = createFileRoute('/')({
  component: ScannerPage,
})

function ScannerPage() {
  const [spinnerText, setSpinnerText] = useState<string>('')
  const [spinnerVisible, setSpinnerVisible] = useState<boolean>(false)
  const [results, setResults] = useState<Result[]>([])
  const [status, setStatus] = useState<string>('')

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const croppedRef = useRef<HTMLCanvasElement | null>(null)
  const fullResRef = useRef<HTMLCanvasElement | null>(null)
  const cameraSelectRef = useRef<HTMLSelectElement | null>(null)

  const webcamController = useRef<Awaited<ReturnType<typeof setupWebcam>> | null>(null)

  function setSpinner(text: string, show = true) {
    setSpinnerText(text)
    setSpinnerVisible(show)
  }

  useEffect(() => {
    let mounted = true

    async function init() {
      // Initialize webcam independently of model loading
      const initWebcam = async () => {
        if (
          videoRef.current &&
          overlayRef.current &&
          croppedRef.current &&
          fullResRef.current
        ) {
          try {
            setSpinner('Loading OpenCV…', true)
            webcamController.current = await setupWebcam({
              video: videoRef.current,
              overlay: overlayRef.current,
              cropped: croppedRef.current,
              fullRes: fullResRef.current,
              onCrop: () => {
                const btn = document.getElementById('searchCroppedBtn') as HTMLButtonElement | null
                if (btn) btn.disabled = false
              },
            })
            console.log('Webcam controller initialized:', webcamController.current)
            setStatus('Webcam ready (model loading in background)')
          } catch (err) {
            console.error('Webcam initialization error:', err)
            setStatus(`Webcam error: ${err instanceof Error ? err.message : 'Unknown error'}`)
          }
        } else {
          console.error('Missing refs:', { 
            video: !!videoRef.current, 
            overlay: !!overlayRef.current, 
            cropped: !!croppedRef.current, 
            fullRes: !!fullResRef.current 
          })
          setStatus('Error: Missing canvas/video elements')
        }
      }

      // Initialize model in background
      const initModel = async () => {
        try {
          setSpinner('Loading embeddings…', true)
          await loadEmbeddingsAndMetaFromPackage()
          setSpinner('Downloading CLIP (vision) model…', true)
          await loadModel({ onProgress: (msg) => mounted && setSpinner(msg, true) })
          setStatus('Model and webcam ready')
        } catch (err) {
          console.error('Model initialization error:', err)
          setStatus('Webcam ready (model failed to load)')
        } finally {
          setSpinner('', false)
        }
      }

      // Run both initializations, but don't let model failure block webcam
      await initWebcam()
      await initModel()
    }

    init()
    return () => {
      mounted = false
    }
  }, [])

  const handleStartCam = async () => {
    if (!webcamController.current) {
      console.error('Webcam controller not initialized')
      setStatus('Error: Webcam controller not ready')
      return
    }
    try {
      await webcamController.current.startVideo(cameraSelectRef.current?.value || null)
      await webcamController.current.populateCameraSelect(cameraSelectRef.current)
      setStatus('Webcam started')
    } catch (err) {
      console.error('Failed to start webcam:', err)
      setStatus(`Error: ${err instanceof Error ? err.message : 'Failed to start webcam'}`)
    }
  }

  const handleCameraChange: React.ChangeEventHandler<HTMLSelectElement> = async (e) => {
    if (!webcamController.current) return
    await webcamController.current.startVideo(e.target.value || null)
    setStatus('Webcam started')
  }

  const handleSearchCropped = async () => {
    if (!croppedRef.current) return
    try {
      setSpinner('Embedding cropped…', true)
      const q = await embedFromCanvas(croppedRef.current)
      setSpinner('Searching…', true)
      const best = top1(q)
      setResults([best as Result])
    } catch (err) {
      console.error('Embedding/search failed:', err)
      setSpinner('Failed to embed/search (see console).', true)
    } finally {
      setSpinner('', false)
    }
  }

  const resCards = useMemo(
    () =>
      results.map((r, idx) => {
        const cardUrl = r.card_url || (r.image_url ? r.image_url.replace('/art_crop/', '/normal/') : '')
        return (
          <div key={idx} data-test="result-item" style={{ margin: '0.8rem 0' }}>
            <b>{r.name}</b> [{r.set}] (score {r.score.toFixed(3)})
            {r.scryfall_uri ? (
              <>
                {' '}
                —{' '}
                <a href={r.scryfall_uri} target="_blank" rel="noopener">
                  Scryfall
                </a>
              </>
            ) : null}
            <br />
            {cardUrl ? (
              <img src={cardUrl} width={240} loading="lazy" decoding="async" />
            ) : null}
          </div>
        )
      }),
    [results],
  )

  return (
    <div style={{ padding: '1rem', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <h1>MTG Card Lookup</h1>
      <p>Use your webcam to select a card. The model runs fully in your browser.</p>
      {spinnerVisible ? (
        <div style={{ margin: '0.8rem 0', color: '#555' }}>{spinnerText || 'Loading…'}</div>
      ) : null}
      <div>{resCards}</div>

      <hr />
      <h2>Webcam (prototype)</h2>
      <div id="webcamControls" style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0', flexWrap: 'wrap' }}>
        <label htmlFor="cameraSelect">Camera:</label>
        <select id="cameraSelect" ref={cameraSelectRef} onChange={handleCameraChange} />
        <button id="startCamBtn" onClick={handleStartCam}>Start Webcam</button>
        <button id="searchCroppedBtn" onClick={handleSearchCropped} disabled>
          Search Cropped
        </button>
        <span style={{ color: '#666' }}>{status}</span>
      </div>
      <div className="camWrap" style={{ position: 'relative', width: 640, height: 480 }}>
        <video id="video" ref={videoRef} autoPlay muted playsInline width={640} height={480} style={{ position: 'absolute', top: 0, left: 0, width: 640, height: 480, border: '1px solid #ccc', zIndex: 0 }} />
        <canvas id="overlay" ref={overlayRef} width={640} height={480} style={{ position: 'absolute', top: 0, left: 0, width: 640, height: 480, border: '1px solid #ccc', cursor: 'pointer', zIndex: 1 }} />
      </div>
      <canvas id="cropped" ref={croppedRef} width={446} height={620} style={{ border: '1px solid #ccc', width: 223, height: 310, marginTop: 8 }} />
      <canvas id="fullRes" ref={fullResRef} width={640} height={480} style={{ display: 'none' }} />
    </div>
  )
}
