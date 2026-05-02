import type { QueuedEvent, Transport, TransportPayload } from './types.js'

const DEFAULT_FLUSH_INTERVAL_MS = 3000
const MIN_FLUSH_INTERVAL_MS = 250
const MAX_FLUSH_INTERVAL_MS = 5000
const MAX_RETRIES = 10
const MAX_RETRY_DELAY_MS = 30 * 60 * 1000

export type RequestQueueOptions = {
  apiKey: string
  endpointUrl: string
  flushAt: number
  flushIntervalMs?: number
  requestTimeoutMs: number
  requestBatching: boolean
  maxQueueSize: number
  compression: boolean
  transport: Transport
}

type RetryItem = {
  batch: QueuedEvent[]
  retries: number
  retryAt: number
}

export class RequestQueue {
  private queue: QueuedEvent[] = []
  private retries: RetryItem[] = []
  private flushTimer?: ReturnType<typeof setTimeout>
  private retryTimer?: ReturnType<typeof setTimeout>
  private flushPromise?: Promise<void>
  private online = true

  constructor(private options: RequestQueueOptions) {
    const navigator = typeof window !== 'undefined' ? window.navigator : undefined
    if (navigator && 'onLine' in navigator) {
      this.online = navigator.onLine
      window.addEventListener('online', this.handleOnline)
      window.addEventListener('offline', this.handleOffline)
    }
  }

  enqueue(event: QueuedEvent): void {
    this.queue.push(event)
    this.trimStoredEvents()

    if (!this.options.requestBatching || this.queue.length >= this.options.flushAt) {
      void this.flush().catch(() => undefined)
      return
    }

    this.scheduleFlush()
  }

  async flush(transport?: 'fetch' | 'sendBeacon'): Promise<void> {
    const previous = this.flushPromise?.catch(() => undefined) ?? Promise.resolve()
    const current = previous.then(() => this.flushOnce(transport))
    this.flushPromise = current
    try {
      await current
    } finally {
      if (this.flushPromise === current) {
        this.flushPromise = undefined
      }
    }
  }

  private async flushOnce(transport?: 'fetch' | 'sendBeacon'): Promise<void> {
    this.clearFlushTimer()
    if (this.queue.length === 0) {
      return
    }
    const batch = this.queue.splice(0, this.options.requestBatching ? this.queue.length : 1)
    await this.sendBatch(batch, transport)
  }

  unload(): void {
    this.clearFlushTimer()
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = undefined
    }
    const batches = [
      this.queue.splice(0, this.queue.length),
      ...this.retries.splice(0, this.retries.length).map((item) => item.batch)
    ].filter((batch) => batch.length > 0)

    for (const batch of batches) {
      void this.options.transport(this.options.endpointUrl, this.payload(batch), {
        timeoutMs: this.options.requestTimeoutMs,
        transport: 'sendBeacon',
        compression: false
      }).catch(() => undefined)
    }
  }

  destroy(): void {
    this.clearFlushTimer()
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline)
      window.removeEventListener('offline', this.handleOffline)
    }
  }

  private async sendBatch(batch: QueuedEvent[], transport?: 'fetch' | 'sendBeacon', retries = 0): Promise<void> {
    try {
      await this.options.transport(this.options.endpointUrl, this.payload(batch), {
        timeoutMs: this.options.requestTimeoutMs,
        transport,
        compression: this.options.compression && transport !== 'sendBeacon'
      })
    } catch (error) {
      if (shouldSplitBatch(error) && batch.length > 1) {
        const midpoint = Math.ceil(batch.length / 2)
        await this.sendBatch(batch.slice(0, midpoint), transport, retries)
        await this.sendBatch(batch.slice(midpoint), transport, retries)
        return
      }
      if (!isRetryableError(error)) {
        throw error
      }
      this.enqueueRetry(batch, retries)
      throw error
    }
  }

  private enqueueRetry(batch: QueuedEvent[], retries: number): void {
    if (retries >= MAX_RETRIES) {
      return
    }
    this.retries.push({
      batch,
      retries: retries + 1,
      retryAt: Date.now() + pickNextRetryDelay(retries)
    })
    this.trimStoredEvents()
    this.scheduleRetry()
  }

  private trimStoredEvents(): void {
    let overflow = this.queue.length + retryEventCount(this.retries) - this.options.maxQueueSize
    if (overflow <= 0) {
      return
    }

    while (overflow > 0 && this.retries.length > 0) {
      const first = this.retries[0]
      if (first.batch.length <= overflow) {
        overflow -= first.batch.length
        this.retries.shift()
        continue
      }

      first.batch.splice(0, overflow)
      overflow = 0
    }

    if (overflow > 0) {
      this.queue.splice(0, overflow)
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) {
      return
    }
    this.flushTimer = setTimeout(() => {
      void this.flush().catch(() => undefined)
    }, clamp(this.options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS, MIN_FLUSH_INTERVAL_MS, MAX_FLUSH_INTERVAL_MS))
  }

  private scheduleRetry(): void {
    if (this.retryTimer || this.retries.length === 0) {
      return
    }

    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined
      if (!this.online) {
        this.scheduleRetry()
        return
      }
      const now = Date.now()
      const ready = this.retries.filter((item) => item.retryAt <= now)
      this.retries = this.retries.filter((item) => item.retryAt > now)
      for (const item of ready) {
        void this.sendBatch(item.batch, 'fetch', item.retries).catch(() => undefined)
      }
      this.scheduleRetry()
    }, 3000)
  }

  private clearFlushTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = undefined
    }
  }

  private payload(batch: QueuedEvent[]): TransportPayload {
    return {
      api_key: this.options.apiKey,
      batch
    }
  }

  private handleOnline = (): void => {
    this.online = true
    this.scheduleRetry()
  }

  private handleOffline = (): void => {
    this.online = false
  }
}

// Adapted and modified for this project from Apache-2.0 licensed retry-delay logic;
// see THIRD_PARTY_NOTICES.md for upstream attribution.
export function pickNextRetryDelay(retriesPerformedSoFar: number): number {
  const rawBackoffTime = 3000 * 2 ** retriesPerformedSoFar
  const minBackoff = rawBackoffTime / 2
  const cappedBackoffTime = Math.min(MAX_RETRY_DELAY_MS, rawBackoffTime)
  const jitterFraction = Math.random() - 0.5
  const jitter = jitterFraction * (cappedBackoffTime - minBackoff)
  return Math.ceil(cappedBackoffTime + jitter)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function retryEventCount(retries: RetryItem[]): number {
  return retries.reduce((total, item) => total + item.batch.length, 0)
}

function isRetryableError(error: unknown): boolean {
  return typeof error !== 'object' || error === null || (error as { retryable?: boolean }).retryable !== false
}

function shouldSplitBatch(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { splitBatch?: boolean }).splitBatch === true
}
