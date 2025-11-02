import type { GatewayCommand } from '@repo/discord-gateway'

import { sanitizeTraceMeta } from '@repo/discord-gateway'

export interface CommandEnvelope {
  command: GatewayCommand
  requestId: string
  traceId: string
  enqueuedAt: number
  attempts: number
  nextAttemptAt: number
}

export type CommandDispatchResult = 'sent' | 'retry'

export type CommandDispatcher = (
  envelope: CommandEnvelope,
) => Promise<CommandDispatchResult>

export interface CommandQueueOptions {
  maxSize?: number
  baseDelayMs?: number
  maxDelayMs?: number
  jitterRatio?: number
  onSizeChange?: (size: number) => void
}

const DEFAULT_OPTIONS = {
  maxSize: 1000,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  jitterRatio: 0.4,
} as const

export interface EnqueueSuccess {
  ok: true
  envelope: CommandEnvelope
}

export interface EnqueueError {
  ok: false
  error: 'QUEUE_FULL'
}

export type EnqueueResult = EnqueueSuccess | EnqueueError

function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return Math.random().toString(16).slice(2)
}

function computeDelay(
  attempts: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitterRatio: number,
): number {
  const exponential = baseDelayMs * 2 ** Math.max(0, attempts - 1)
  const capped = Math.min(exponential, maxDelayMs)
  const jitter = Math.random() * jitterRatio * capped

  return Math.min(maxDelayMs, Math.round(capped + jitter))
}

export class CommandQueue {
  private readonly options: {
    maxSize: number
    baseDelayMs: number
    maxDelayMs: number
    jitterRatio: number
    onSizeChange?: (size: number) => void
  }

  private readonly queue: CommandEnvelope[] = []

  private timer: NodeJS.Timeout | null = null

  private draining = false

  constructor(
    private readonly dispatcher: CommandDispatcher,
    options: CommandQueueOptions = {},
  ) {
    this.options = {
      maxSize: options.maxSize ?? DEFAULT_OPTIONS.maxSize,
      baseDelayMs: options.baseDelayMs ?? DEFAULT_OPTIONS.baseDelayMs,
      maxDelayMs: options.maxDelayMs ?? DEFAULT_OPTIONS.maxDelayMs,
      jitterRatio: options.jitterRatio ?? DEFAULT_OPTIONS.jitterRatio,
      onSizeChange: options.onSizeChange,
    }
  }

  get size(): number {
    return this.queue.length
  }

  isSaturated(): boolean {
    return this.queue.length >= this.options.maxSize
  }

  enqueue(command: GatewayCommand): EnqueueResult {
    if (this.isSaturated()) {
      return { ok: false, error: 'QUEUE_FULL' }
    }

    const meta = sanitizeTraceMeta(command.meta)

    const envelope: CommandEnvelope = {
      command: {
        ...command,
        meta,
      },
      requestId: meta.requestId ?? generateId(),
      traceId: meta.traceId,
      enqueuedAt: Date.now(),
      attempts: 0,
      nextAttemptAt: Date.now(),
    }

    this.queue.push(envelope)
    this.sortQueue()
    this.schedule()
    this.notifySizeChange()

    return { ok: true, envelope }
  }

  remove(predicate: (envelope: CommandEnvelope) => boolean): void {
    const index = this.queue.findIndex(predicate)
    if (index === -1) {
      return
    }

    this.queue.splice(index, 1)
    if (this.queue.length === 0) {
      this.clearTimer()
    }

    this.notifySizeChange()
  }

  clear(): void {
    this.queue.length = 0
    this.clearTimer()
    this.notifySizeChange()
  }

  markReady(): void {
    if (this.queue.length === 0) {
      return
    }

    const now = Date.now()
    for (const envelope of this.queue) {
      if (envelope.nextAttemptAt > now) {
        envelope.nextAttemptAt = now
      }
    }

    this.sortQueue()
    this.clearTimer()
    this.schedule()
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => a.nextAttemptAt - b.nextAttemptAt)
  }

  private schedule(): void {
    if (this.draining || this.timer || this.queue.length === 0) {
      return
    }

    const delay = Math.max(0, this.queue[0]!.nextAttemptAt - Date.now())

    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, delay)
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private async flush(): Promise<void> {
    if (this.draining) {
      return
    }

    this.draining = true

    try {
      while (this.queue.length > 0) {
        const next = this.queue[0]!
        const now = Date.now()

        if (next.nextAttemptAt > now) {
          break
        }

        const result = await this.dispatcher(next)

        if (result === 'sent') {
          this.queue.shift()
          this.notifySizeChange()
          continue
        }

        next.attempts += 1
        next.nextAttemptAt =
          Date.now() +
          computeDelay(
            next.attempts,
            this.options.baseDelayMs,
            this.options.maxDelayMs,
            this.options.jitterRatio,
          )

        this.sortQueue()
      }
    } finally {
      this.draining = false
      if (this.queue.length === 0) {
        this.clearTimer()
        return
      }

      this.schedule()
    }
  }

  private notifySizeChange(): void {
    this.options.onSizeChange?.(this.queue.length)
  }
}
