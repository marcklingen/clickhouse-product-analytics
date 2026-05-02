import { autocaptureProperties, eventTarget, shouldAutocapture } from './autocapture.js'
import { uuidv7Like } from './ids.js'
import { RequestQueue } from './request-queue.js'
import { createStorage } from './storage.js'
import { SDK_VERSION } from './version.js'
import type {
  AutocaptureConfig,
  BeforeSendHook,
  CaptureOptions,
  CaptureProperties,
  InitOptions,
  QueuedEvent,
  Transport,
  TransportPayload
} from './types.js'

export type {
  AutocaptureConfig,
  BeforeSendHook,
  CaptureOptions,
  CaptureProperties,
  InitOptions,
  QueuedEvent,
  Transport,
  TransportPayload
} from './types.js'

type StoredState = {
  distinctId: string
  deviceId: string
  userState: 'anonymous' | 'identified'
  sessionId: string
  windowId: string
  sessionLastSeen: number
  sessionStartedAt: number
  optedOut: boolean
  superProperties: CaptureProperties
}

type NormalizedOptions = {
  apiHost: string
  apiKey: string
  batchEndpoint: string
  capturePageview: boolean | 'history_change'
  capturePageleave: boolean | 'if_capture_pageview'
  autocapture: boolean | AutocaptureConfig
  requestBatching: boolean
  flushAt: number
  flushIntervalMs: number
  requestTimeoutMs: number
  maxQueueSize: number
  sessionTimeoutMs: number
  persistence: 'localStorage' | 'memory' | 'localStorage+cookie'
  disablePersistence: boolean
  beforeSend: BeforeSendHook[]
  propertyDenylist: string[]
  compression: boolean
  loaded?: (client: ClickHouseProductAnalytics) => void
  debug: boolean
  transport: Transport
}

const STORAGE_KEY = 'clickhouse_product_analytics'
const DEFAULT_FLUSH_AT = 20
const DEFAULT_TIMEOUT_MS = 10000
const DEFAULT_MAX_QUEUE_SIZE = 1000
const DEFAULT_SESSION_TIMEOUT_MS = 30 * 60 * 1000

/** Browser analytics client for capturing product events into the ingest service. */
export class ClickHouseProductAnalytics {
  private options?: NormalizedOptions
  private storage = createStorage('memory', true)
  private state?: StoredState
  private queue?: RequestQueue
  private listeners: Array<() => void> = []
  private pageleaveCaptured = false

  /** Initialize the client with a publishable API key and browser SDK options. */
  init(token: string, config?: Omit<InitOptions, 'apiKey' | 'token'>): this
  /** Initialize the client with a complete options object. */
  init(config: InitOptions): this
  init(tokenOrConfig: string | InitOptions, maybeConfig: Omit<InitOptions, 'apiKey' | 'token'> = {}): this {
    const input = typeof tokenOrConfig === 'string'
      ? { ...maybeConfig, apiKey: tokenOrConfig, token: tokenOrConfig }
      : tokenOrConfig

    this.options = normalizeOptions(input)
    this.storage = createStorage(this.options.persistence, this.options.disablePersistence)
    this.state = this.loadState()
    this.queue?.destroy()
    this.queue = new RequestQueue({
      apiKey: this.options.apiKey,
      endpointUrl: this.endpointUrl(),
      flushAt: this.options.flushAt,
      flushIntervalMs: this.options.flushIntervalMs,
      requestTimeoutMs: this.options.requestTimeoutMs,
      requestBatching: this.options.requestBatching,
      maxQueueSize: this.options.maxQueueSize,
      compression: this.options.compression,
      transport: this.options.transport
    })

    this.installLifecycleHandlers()
    this.installAutocapture()
    this.installHistoryCapture()

    if (this.options.capturePageview) {
      this.capture('$pageview', this.currentPageProperties(), { send_instantly: true })
    }
    this.options.loaded?.(this)
    return this
  }

  /** Capture a named event with optional properties. */
  capture(eventName: string, properties: CaptureProperties | null = {}, options: CaptureOptions = {}): QueuedEvent | undefined {
    this.assertInitialized()
    if (!this.is_capturing() || typeof eventName !== 'string' || !eventName.trim()) {
      return undefined
    }

    this.touchSession()
    const timestamp = options.timestamp ?? new Date()
    const distinctId = options.distinct_id ? normalizeDistinctId(options.distinct_id) : this.state!.distinctId
    const allProperties = this.applyPropertyDenylist({
      ...this.state!.superProperties,
      ...this.sessionProperties(),
      ...(properties ?? {}),
      distinct_id: distinctId,
      '$device_id': this.state!.deviceId
    })

    let event: QueuedEvent = {
      uuid: uuidv7Like(timestamp.getTime()),
      event: eventName,
      properties: allProperties,
      timestamp: timestamp.toISOString()
    }

    if (options.$set) {
      event.properties.$set = options.$set
    }
    if (options.$set_once) {
      event.properties.$set_once = options.$set_once
    }

    for (const hook of this.options!.beforeSend) {
      const result = hook(event)
      if (!result) {
        return undefined
      }
      event = result
    }

    event.properties = this.applyPropertyDenylist(event.properties)

    this.queue!.enqueue(event)
    if (options.send_instantly) {
      void this.flush(options.transport).catch(() => undefined)
    }
    return event
  }

  /** Associate future events with a known user and optionally set person properties. */
  identify(newDistinctId?: string, userPropertiesToSet: CaptureProperties = {}, userPropertiesToSetOnce: CaptureProperties = {}): void {
    this.assertInitialized()
    const distinctId = normalizeDistinctId(newDistinctId ?? this.state!.distinctId)
    const previousDistinctId = this.state!.distinctId
    const wasAnonymous = this.state!.userState === 'anonymous'

    this.register({ '$user_id': distinctId })
    this.register_once({
      '$had_persisted_distinct_id': true,
      '$device_id': this.state!.deviceId
    }, '')

    if (distinctId !== previousDistinctId) {
      this.state!.distinctId = distinctId
      this.state!.userState = 'identified'
      this.persistState()
    }

    if (distinctId !== previousDistinctId && wasAnonymous) {
      this.capture('$identify', {
        distinct_id: distinctId,
        '$anon_distinct_id': previousDistinctId
      }, {
        $set: userPropertiesToSet,
        $set_once: userPropertiesToSetOnce,
        send_instantly: true
      })
    } else if (Object.keys(userPropertiesToSet).length > 0 || Object.keys(userPropertiesToSetOnce).length > 0) {
      this.setPersonProperties(userPropertiesToSet, userPropertiesToSetOnce)
    }
  }

  /** Set or set-once person properties for the current distinct ID. */
  setPersonProperties(userPropertiesToSet: CaptureProperties = {}, userPropertiesToSetOnce: CaptureProperties = {}): void {
    if (Object.keys(userPropertiesToSet).length === 0 && Object.keys(userPropertiesToSetOnce).length === 0) {
      return
    }
    this.capture('$set', {
      '$set': userPropertiesToSet,
      '$set_once': userPropertiesToSetOnce
    }, { send_instantly: true })
  }

  /** Link another distinct ID to the current or supplied original distinct ID. */
  alias(alias: string, original = this.get_distinct_id()): QueuedEvent | undefined {
    return this.capture('$create_alias', { alias }, { distinct_id: original, send_instantly: true })
  }

  /** Reset local identity and session state, optionally generating a new device ID. */
  reset(resetDeviceId = false): void {
    this.assertInitialized()
    const deviceId = resetDeviceId ? uuidv7Like() : this.state!.deviceId
    this.state = {
      distinctId: uuidv7Like(),
      deviceId,
      userState: 'anonymous',
      sessionId: uuidv7Like(),
      windowId: uuidv7Like(),
      sessionLastSeen: Date.now(),
      sessionStartedAt: Date.now(),
      optedOut: this.state!.optedOut,
      superProperties: {
        '$last_reset': new Date().toISOString()
      }
    }
    this.persistState()
  }

  /** Register properties that are attached to all future events. */
  register(properties: CaptureProperties): void {
    this.assertInitialized()
    this.state!.superProperties = {
      ...this.state!.superProperties,
      ...properties
    }
    this.persistState()
  }

  /** Register properties only when their current value is absent or equal to `defaultValue`. */
  register_once(properties: CaptureProperties, defaultValue: unknown = 'None'): void {
    this.assertInitialized()
    for (const [key, value] of Object.entries(properties)) {
      if (this.state!.superProperties[key] === undefined || this.state!.superProperties[key] === defaultValue) {
        this.state!.superProperties[key] = value
      }
    }
    this.persistState()
  }

  /** Remove a registered super property from future events. */
  unregister(property: string): void {
    this.assertInitialized()
    delete this.state!.superProperties[property]
    this.persistState()
  }

  /** Return the current distinct ID. */
  get_distinct_id(): string {
    this.assertInitialized()
    return this.state!.distinctId
  }

  /** Return the current session ID, rotating the session first if it has expired. */
  get_session_id(): string {
    this.assertInitialized()
    this.touchSession()
    return this.state!.sessionId
  }

  /** Return a registered property value or the current distinct ID. */
  get_property(property: string): unknown {
    this.assertInitialized()
    return property === 'distinct_id' ? this.state!.distinctId : this.state!.superProperties[property]
  }

  /** Stop capturing events until `opt_in_capturing` is called. */
  opt_out_capturing(): void {
    this.assertInitialized()
    this.state!.optedOut = true
    this.persistState()
  }

  /** Resume capturing events after an opt-out. */
  opt_in_capturing(): void {
    this.assertInitialized()
    this.state!.optedOut = false
    this.persistState()
  }

  /** Return whether this client is currently opted out. */
  has_opted_out_capturing(): boolean {
    this.assertInitialized()
    return this.state!.optedOut
  }

  /** Return whether this client will enqueue new events. */
  is_capturing(): boolean {
    return !this.state?.optedOut
  }

  /** Flush queued events using fetch or, when requested, sendBeacon. */
  async flush(transport?: 'fetch' | 'sendBeacon'): Promise<void> {
    this.assertInitialized()
    await this.queue!.flush(transport)
  }

  /** Remove lifecycle listeners and stop queue timers. */
  shutdown(): void {
    this.listeners.splice(0).forEach((unsubscribe) => unsubscribe())
    this.queue?.destroy()
  }

  private assertInitialized(): void {
    if (!this.options || !this.state || !this.queue) {
      throw new Error('ClickHouseProductAnalytics must be initialized first')
    }
  }

  private loadState(): StoredState {
    const raw = this.storage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<StoredState>
        if (parsed.distinctId && parsed.deviceId && parsed.sessionId && parsed.windowId) {
          return {
            distinctId: parsed.distinctId,
            deviceId: parsed.deviceId,
            userState: parsed.userState ?? 'anonymous',
            sessionId: parsed.sessionId,
            windowId: parsed.windowId,
            sessionLastSeen: parsed.sessionLastSeen ?? Date.now(),
            sessionStartedAt: parsed.sessionStartedAt ?? Date.now(),
            optedOut: parsed.optedOut ?? false,
            superProperties: parsed.superProperties ?? {}
          }
        }
      } catch {
        this.storage.removeItem(STORAGE_KEY)
      }
    }

    const deviceId = uuidv7Like()
    const now = Date.now()
    const state: StoredState = {
      distinctId: deviceId,
      deviceId,
      userState: 'anonymous',
      sessionId: uuidv7Like(),
      windowId: uuidv7Like(),
      sessionLastSeen: now,
      sessionStartedAt: now,
      optedOut: false,
      superProperties: {}
    }
    this.state = state
    this.persistState()
    return state
  }

  private persistState(): void {
    if (this.state) {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    }
  }

  private touchSession(): void {
    const now = Date.now()
    if (now - this.state!.sessionLastSeen > this.options!.sessionTimeoutMs || now - this.state!.sessionStartedAt > 24 * 60 * 60 * 1000) {
      this.state!.sessionId = uuidv7Like()
      this.state!.windowId = uuidv7Like()
      this.state!.sessionStartedAt = now
    }
    this.state!.sessionLastSeen = now
    this.persistState()
  }

  private sessionProperties(): CaptureProperties {
    return {
      '$session_id': this.state!.sessionId,
      '$window_id': this.state!.windowId,
      '$lib': 'clickhouse-product-analytics-js',
      '$lib_version': SDK_VERSION,
      '$configured_session_timeout_ms': this.options!.sessionTimeoutMs
    }
  }

  private currentPageProperties(): CaptureProperties {
    if (typeof window === 'undefined') {
      return {}
    }
    return {
      '$current_url': window.location.href,
      '$host': window.location.host,
      '$pathname': window.location.pathname,
      '$referrer': typeof document !== 'undefined' ? document.referrer : undefined,
      '$title': typeof document !== 'undefined' ? document.title : undefined
    }
  }

  private installLifecycleHandlers(): void {
    this.listeners.splice(0).forEach((unsubscribe) => unsubscribe())
    if (typeof window === 'undefined') {
      return
    }

    const unload = (): void => {
      if (this.shouldCapturePageleave() && !this.pageleaveCaptured) {
        this.pageleaveCaptured = true
        this.capture('$pageleave', this.currentPageProperties(), { transport: 'sendBeacon' })
      }
      this.queue?.unload()
    }
    const visibility = (): void => {
      if (document.visibilityState === 'hidden') {
        unload()
      }
    }

    window.addEventListener('pagehide', unload)
    window.addEventListener('beforeunload', unload)
    document.addEventListener('visibilitychange', visibility)
    this.listeners.push(() => window.removeEventListener('pagehide', unload))
    this.listeners.push(() => window.removeEventListener('beforeunload', unload))
    this.listeners.push(() => document.removeEventListener('visibilitychange', visibility))
  }

  private installHistoryCapture(): void {
    if (typeof window === 'undefined' || this.options!.capturePageview !== 'history_change') {
      return
    }
    const capture = (): void => {
      this.capture('$pageview', this.currentPageProperties(), { send_instantly: true })
    }
    const wrap = (method: 'pushState' | 'replaceState'): void => {
      const original = window.history[method]
      window.history[method] = function patchedHistory(this: History, ...args: Parameters<History['pushState']>) {
        const result = original.apply(this, args)
        window.dispatchEvent(new Event('cpa-history-change'))
        return result
      } as History[typeof method]
      this.listeners.push(() => {
        window.history[method] = original
      })
    }
    wrap('pushState')
    wrap('replaceState')
    window.addEventListener('popstate', capture)
    window.addEventListener('cpa-history-change', capture)
    this.listeners.push(() => window.removeEventListener('popstate', capture))
    this.listeners.push(() => window.removeEventListener('cpa-history-change', capture))
  }

  private installAutocapture(): void {
    if (!this.options!.autocapture || typeof document === 'undefined') {
      return
    }
    const config = typeof this.options!.autocapture === 'boolean' ? {} : this.options!.autocapture
    const handler = (event: Event): void => {
      const target = eventTarget(event)
      if (!target || !shouldAutocapture(target, event, config)) {
        return
      }
      this.capture('$autocapture', {
        ...autocaptureProperties(target, event, config),
        ...this.currentPageProperties()
      })
    }

    for (const eventName of ['click', 'change', 'submit']) {
      document.addEventListener(eventName, handler, true)
      this.listeners.push(() => document.removeEventListener(eventName, handler, true))
    }
  }

  private shouldCapturePageleave(): boolean {
    const configured = this.options?.capturePageleave
    return configured === true || (configured === 'if_capture_pageview' && this.options?.capturePageview !== false)
  }

  private applyPropertyDenylist(properties: CaptureProperties): CaptureProperties {
    const next = { ...properties }
    for (const property of this.options!.propertyDenylist) {
      delete next[property]
    }
    return truncateStrings(next, 65535)
  }

  private endpointUrl(): string {
    return `${this.options!.apiHost}${this.options!.batchEndpoint}`
  }
}

/** Create an isolated analytics client instance. */
export const createClient = (): ClickHouseProductAnalytics => new ClickHouseProductAnalytics()

const defaultClient = createClient()

export default defaultClient

function normalizeOptions(input: InitOptions): NormalizedOptions {
  const apiKey = input.apiKey ?? input.token
  const apiHost = input.apiHost ?? input.api_host
  if (!apiKey) {
    throw new Error('apiKey/token is required')
  }
  if (!apiHost) {
    throw new Error('apiHost/api_host is required')
  }

  const beforeSend = input.before_send
    ? Array.isArray(input.before_send) ? input.before_send : [input.before_send]
    : []

  return {
    apiHost: apiHost.replace(/\/+$/, ''),
    apiKey,
    batchEndpoint: input.batchEndpoint ?? '/batch/',
    capturePageview: input.capturePageview ?? input.capture_pageview ?? true,
    capturePageleave: input.capturePageleave ?? input.capture_pageleave ?? 'if_capture_pageview',
    autocapture: input.autocapture ?? false,
    requestBatching: input.request_batching ?? true,
    flushAt: input.flushAt ?? DEFAULT_FLUSH_AT,
    flushIntervalMs: input.flushIntervalMs ?? input.request_queue_config?.flush_interval_ms ?? 3000,
    requestTimeoutMs: input.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxQueueSize: input.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE,
    sessionTimeoutMs: input.sessionTimeoutMs ?? DEFAULT_SESSION_TIMEOUT_MS,
    persistence: input.persistence ?? 'localStorage+cookie',
    disablePersistence: input.disable_persistence ?? false,
    beforeSend,
    propertyDenylist: input.property_denylist ?? [],
    compression: !(input.disable_compression ?? false),
    loaded: input.loaded as ((client: ClickHouseProductAnalytics) => void) | undefined,
    debug: input.debug ?? false,
    transport: input.transport ?? browserTransport
  }
}

async function browserTransport(
  url: string,
  payload: TransportPayload,
  options: {
    timeoutMs: number
    transport?: 'fetch' | 'sendBeacon'
    compression?: boolean
  }
): Promise<void> {
  const body = safeJsonStringify(payload)

  if (options.transport === 'sendBeacon' && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' })
    const accepted = navigator.sendBeacon(urlWithParams(url, { beacon: '1' }), blob)
    if (accepted) {
      return
    }
  }

  if (typeof fetch === 'undefined') {
    throw new Error('fetch is unavailable; provide a custom transport')
  }

  const encoded = await encodeBrowserPayload(body, options.compression ?? false)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs)
  try {
    const response = await fetch(urlWithParams(url, { _: Date.now().toString(), ver: SDK_VERSION }), {
      method: 'POST',
      headers: encoded.headers,
      body: encoded.body,
      keepalive: encoded.byteLength < 60_000,
      signal: controller.signal
    })

    if (!response.ok) {
      const error = new Error(`capture request failed with HTTP ${response.status}`) as Error & {
        retryable?: boolean
        splitBatch?: boolean
      }
      error.retryable = response.status === 408 || response.status === 429 || response.status >= 500
      error.splitBatch = response.status === 413
      throw error
    }
  } finally {
    clearTimeout(timeout)
  }
}

type EncodedBrowserPayload = {
  body: BodyInit
  byteLength: number
  headers: Record<string, string>
}

async function encodeBrowserPayload(body: string, compression: boolean): Promise<EncodedBrowserPayload> {
  const plain = (): EncodedBrowserPayload => ({
    body,
    byteLength: textByteLength(body),
    headers: {
      'content-type': 'application/json'
    }
  })

  if (!compression || typeof CompressionStream === 'undefined' || typeof ReadableStream === 'undefined' || typeof Response === 'undefined') {
    return plain()
  }

  try {
    const bytes = new TextEncoder().encode(body)
    const compressionStream = new CompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      }
    }).pipeThrough(compressionStream)
    const compressed = await new Response(stream).arrayBuffer()
    return {
      body: compressed,
      byteLength: compressed.byteLength,
      headers: {
        'content-type': 'application/json',
        'content-encoding': 'gzip'
      }
    }
  } catch {
    return plain()
  }
}

function textByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

function safeJsonStringify(value: unknown): string {
  const seen = new WeakSet<object>()
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === 'bigint') {
      return item.toString()
    }
    if (typeof item === 'object' && item !== null) {
      if (seen.has(item)) {
        return '[Circular]'
      }
      seen.add(item)
    }
    return item
  }) ?? 'null'
}

function urlWithParams(url: string, params: Record<string, string>): string {
  const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost')
  for (const [key, value] of Object.entries(params)) {
    parsed.searchParams.set(key, value)
  }
  return parsed.toString()
}

function normalizeDistinctId(value: string): string {
  if (!value || !value.trim() || ['null', 'undefined', 'true', 'false'].includes(value)) {
    throw new Error('distinct_id must be a unique non-empty string')
  }
  return value
}

function truncateStrings(value: unknown, maxLength: number): CaptureProperties {
  const sanitized = sanitizeValue(value, maxLength, new WeakSet<object>())
  return isPlainObject(sanitized) ? sanitized : {}
}

function sanitizeValue(value: unknown, maxLength: number, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') {
    return value.slice(0, maxLength)
  }
  if (typeof value === 'bigint') {
    return value.toString()
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[Circular]'
    }
    seen.add(value)
    const sanitized = value.map((entry) => sanitizeValue(entry, maxLength, seen))
    seen.delete(value)
    return sanitized
  }
  if (!isPlainObject(value)) {
    return value
  }
  if (seen.has(value)) {
    return '[Circular]'
  }
  seen.add(value)
  const next: CaptureProperties = {}
  for (const [key, item] of Object.entries(value)) {
    const sanitized = sanitizeValue(item, maxLength, seen)
    if (sanitized !== undefined) {
      next[key] = sanitized
    }
  }
  seen.delete(value)
  return next
}

function isPlainObject(value: unknown): value is CaptureProperties {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
