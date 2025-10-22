/**
 * Loading event system for tracking game room initialization progress
 *
 * Provides a centralized event emitter for tracking:
 * - Card embeddings loading
 * - CLIP model download
 * - OpenCV.js loading
 * - Detector initialization
 * - Game room setup
 */

export type LoadingStep =
  | 'embeddings'
  | 'clip-model'
  | 'opencv'
  | 'detector'
  | 'game-room'
  | 'complete'

export interface LoadingEvent {
  step: LoadingStep
  progress: number // 0-100
  message: string
}

type LoadingListener = (event: LoadingEvent) => void

class LoadingEventEmitter {
  private listeners: LoadingListener[] = []

  subscribe(listener: LoadingListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  emit(event: LoadingEvent): void {
    this.listeners.forEach((listener) => listener(event))
  }

  clear(): void {
    this.listeners = []
  }
}

export const loadingEvents = new LoadingEventEmitter()
