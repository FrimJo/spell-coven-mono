import { expect, type Page } from '@playwright/test'

export async function expectVideoRendering(
  page: Page,
  videoSelector: string,
): Promise<void> {
  const result = await page.evaluate(async (selector) => {
    const video = document.querySelector(selector) as HTMLVideoElement | null
    if (!video) return { ok: false, reason: 'no-video-element' }

    const start = performance.now()
    while (performance.now() - start < 8000) {
      if (video.readyState >= 3 && video.videoWidth > 0) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    if (!(video.readyState >= 3 && video.videoWidth > 0)) {
      return { ok: false, reason: 'no-frames' }
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.min(320, video.videoWidth)
    canvas.height = Math.min(180, video.videoHeight || 180)
    const ctx = canvas.getContext('2d')
    if (!ctx) return { ok: false, reason: 'no-canvas-context' }

    const frameHash = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let sum = 0
      for (let i = 0; i < data.length; i += 97) {
        sum = (sum + data[i]) | 0
      }
      return sum
    }

    const h1 = frameHash()
    await new Promise((resolve) => setTimeout(resolve, 250))
    const h2 = frameHash()
    await new Promise((resolve) => setTimeout(resolve, 250))
    const h3 = frameHash()

    const changing = h1 !== h2 || h2 !== h3
    return { ok: changing, reason: changing ? 'ok' : 'frozen' }
  }, videoSelector)

  expect(result.ok, `video check failed: ${result.reason}`).toBeTruthy()
}

export async function expectVideoFrozen(
  page: Page,
  videoSelector: string,
): Promise<void> {
  const result = await page.evaluate(async (selector) => {
    const video = document.querySelector(selector) as HTMLVideoElement | null
    if (!video) return { ok: false, reason: 'no-video-element' }

    const canvas = document.createElement('canvas')
    canvas.width = Math.min(320, video.videoWidth || 320)
    canvas.height = Math.min(180, video.videoHeight || 180)
    const ctx = canvas.getContext('2d')
    if (!ctx) return { ok: false, reason: 'no-canvas-context' }

    const frameHash = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let sum = 0
      for (let i = 0; i < data.length; i += 97) {
        sum = (sum + data[i]) | 0
      }
      return sum
    }

    const h1 = frameHash()
    await new Promise((resolve) => setTimeout(resolve, 400))
    const h2 = frameHash()
    await new Promise((resolve) => setTimeout(resolve, 400))
    const h3 = frameHash()

    const frozen = h1 === h2 && h2 === h3
    return { ok: frozen, reason: frozen ? 'ok' : 'changing' }
  }, videoSelector)

  expect(result.ok, `video freeze check failed: ${result.reason}`).toBeTruthy()
}

export async function expectAudioEnergy(
  page: Page,
  mediaSelector: string,
  threshold = 0.01,
): Promise<void> {
  const result = await page.evaluate(
    async ({ selector, threshold }) => {
      const element = document.querySelector(selector) as HTMLMediaElement | null
      if (!element) return { ok: false, reason: 'no-media-element' }

      try {
        await element.play()
      } catch {
        // Autoplay might be blocked; continue to probe audio anyway.
      }

      const AudioContextConstructor =
        window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioContextConstructor) {
        return { ok: false, reason: 'no-audio-context' }
      }

      const ctx = new AudioContextConstructor()
      const source = ctx.createMediaElementSource(element)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      analyser.connect(ctx.destination)

      const data = new Float32Array(analyser.fftSize)
      const samples = 20
      let maxRms = 0

      for (let i = 0; i < samples; i += 1) {
        analyser.getFloatTimeDomainData(data)
        let sum = 0
        for (let j = 0; j < data.length; j += 1) {
          sum += data[j] * data[j]
        }
        const rms = Math.sqrt(sum / data.length)
        if (rms > maxRms) maxRms = rms
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      const ok = maxRms > threshold
      return { ok, maxRms, reason: ok ? 'ok' : 'silent' }
    },
    { selector: mediaSelector, threshold },
  )

  expect(
    result.ok,
    `audio check failed: ${result.reason}, maxRms=${result.maxRms}`,
  ).toBeTruthy()
}

export async function expectAudioSilent(
  page: Page,
  mediaSelector: string,
  threshold = 0.005,
): Promise<void> {
  const result = await page.evaluate(
    async ({ selector, threshold }) => {
      const element = document.querySelector(selector) as HTMLMediaElement | null
      if (!element) return { ok: false, reason: 'no-media-element' }

      const AudioContextConstructor =
        window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioContextConstructor) {
        return { ok: false, reason: 'no-audio-context' }
      }

      const ctx = new AudioContextConstructor()
      const source = ctx.createMediaElementSource(element)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      analyser.connect(ctx.destination)

      const data = new Float32Array(analyser.fftSize)
      const samples = 10
      let maxRms = 0

      for (let i = 0; i < samples; i += 1) {
        analyser.getFloatTimeDomainData(data)
        let sum = 0
        for (let j = 0; j < data.length; j += 1) {
          sum += data[j] * data[j]
        }
        const rms = Math.sqrt(sum / data.length)
        if (rms > maxRms) maxRms = rms
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      const ok = maxRms <= threshold
      return { ok, maxRms, reason: ok ? 'ok' : 'audible' }
    },
    { selector: mediaSelector, threshold },
  )

  expect(
    result.ok,
    `audio silence check failed: ${result.reason}, maxRms=${result.maxRms}`,
  ).toBeTruthy()
}
