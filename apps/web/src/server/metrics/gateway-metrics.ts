export interface CounterMetric {
  readonly name: string
  increment(by?: number): void
  value(): number
  reset(): void
}

export interface GaugeMetric {
  readonly name: string
  set(value: number): void
  increment(by?: number): void
  decrement(by?: number): void
  value(): number
  reset(): void
}

export interface HistogramMetric {
  readonly name: string
  record(value: number): void
  values(): readonly number[]
  reset(): void
}

const DEFAULT_HISTOGRAM_CAP = 200

class Counter implements CounterMetric {
  #value = 0

  constructor(public readonly name: string) {}

  increment(by = 1): void {
    if (!Number.isFinite(by) || by <= 0) {
      return
    }

    this.#value += by
  }

  value(): number {
    return this.#value
  }

  reset(): void {
    this.#value = 0
  }
}

class Gauge implements GaugeMetric {
  #value = 0

  constructor(public readonly name: string) {}

  set(value: number): void {
    if (!Number.isFinite(value)) {
      return
    }

    this.#value = value
  }

  increment(by = 1): void {
    if (!Number.isFinite(by)) {
      return
    }

    this.#value += by
  }

  decrement(by = 1): void {
    if (!Number.isFinite(by)) {
      return
    }

    this.#value -= by
  }

  value(): number {
    return this.#value
  }

  reset(): void {
    this.#value = 0
  }
}

class Histogram implements HistogramMetric {
  readonly #samples: number[] = []

  constructor(
    public readonly name: string,
    private readonly capacity: number = DEFAULT_HISTOGRAM_CAP,
  ) {}

  record(value: number): void {
    if (!Number.isFinite(value)) {
      return
    }

    this.#samples.push(value)

    if (this.#samples.length > this.capacity) {
      this.#samples.shift()
    }
  }

  values(): readonly number[] {
    return this.#samples
  }

  reset(): void {
    this.#samples.length = 0
  }
}

export interface GatewayMetrics {
  eventsReceived: CounterMetric
  commandsEnqueued: CounterMetric
  commandsSent: CounterMetric
  commandFailures: CounterMetric
  commandRetries: CounterMetric
  queueDepth: GaugeMetric
  connectionState: GaugeMetric
  sseSubscribers: GaugeMetric
  eventLatencyMs: HistogramMetric
  commandLatencyMs: HistogramMetric
  reconnectLatencyMs: HistogramMetric
}

function createGatewayMetrics(): GatewayMetrics {
  return {
    eventsReceived: new Counter('gateway_events_received_total'),
    commandsEnqueued: new Counter('gateway_commands_enqueued_total'),
    commandsSent: new Counter('gateway_commands_sent_total'),
    commandFailures: new Counter('gateway_command_failures_total'),
    commandRetries: new Counter('gateway_command_retries_total'),
    queueDepth: new Gauge('gateway_command_queue_depth'),
    connectionState: new Gauge('gateway_ws_connected'),
    sseSubscribers: new Gauge('gateway_sse_subscribers'),
    eventLatencyMs: new Histogram('gateway_event_latency_ms'),
    commandLatencyMs: new Histogram('gateway_command_latency_ms'),
    reconnectLatencyMs: new Histogram('gateway_ws_reconnect_latency_ms'),
  }
}

export const gatewayMetrics: GatewayMetrics =
  (globalThis as unknown as { __gatewayMetrics?: GatewayMetrics }).__gatewayMetrics ??
  createGatewayMetrics()

if (!(globalThis as { __gatewayMetrics?: GatewayMetrics }).__gatewayMetrics) {
  ;(globalThis as { __gatewayMetrics?: GatewayMetrics }).__gatewayMetrics = gatewayMetrics
}

export function resetGatewayMetrics(): void {
  gatewayMetrics.eventsReceived.reset()
  gatewayMetrics.commandsEnqueued.reset()
  gatewayMetrics.commandsSent.reset()
  gatewayMetrics.commandFailures.reset()
  gatewayMetrics.commandRetries.reset()
  gatewayMetrics.queueDepth.reset()
  gatewayMetrics.connectionState.reset()
  gatewayMetrics.sseSubscribers.reset()
  gatewayMetrics.eventLatencyMs.reset()
  gatewayMetrics.commandLatencyMs.reset()
  gatewayMetrics.reconnectLatencyMs.reset()
}
