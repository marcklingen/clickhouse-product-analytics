/** JSON-serializable event or person properties. */
export type CaptureProperties = Record<string, unknown>

/** Per-event options accepted by {@link ClickHouseProductAnalytics.capture}. */
export type CaptureOptions = {
  /** Override the event timestamp. Defaults to the current time. */
  timestamp?: Date
  /** Flush the queue immediately after enqueueing this event. */
  send_instantly?: boolean
  /** Force a specific transport for this event's flush. */
  transport?: 'fetch' | 'sendBeacon'
  /** Send the event under a distinct ID other than the current client ID. */
  distinct_id?: string
  /** Person properties to overwrite when sending identity events. */
  $set?: CaptureProperties
  /** Person properties to set only if the target property is currently absent. */
  $set_once?: CaptureProperties
}

/** Event envelope stored in the browser queue and sent to the ingest service. */
export type QueuedEvent = {
  uuid: string
  event: string
  properties: CaptureProperties
  timestamp: string
}

/** Batch payload sent to the public ingest API. */
export type TransportPayload = {
  /** Optional ingest API key. Allowed-origin browser payloads can omit it. */
  api_key?: string
  batch: QueuedEvent[]
}

/** Custom transport hook for applications that need to override fetch/beacon delivery. */
export type Transport = (
  url: string,
  payload: TransportPayload,
  options: {
    timeoutMs: number
    transport?: 'fetch' | 'sendBeacon'
    compression?: boolean
  }
) => Promise<void>

export type BeforeSendEvent = QueuedEvent

/** Hook that can mutate an event before enqueueing it, or return a falsy value to drop it. */
export type BeforeSendHook = (event: BeforeSendEvent) => BeforeSendEvent | false | null | undefined

/** Privacy-oriented autocapture settings. Autocapture is disabled unless enabled explicitly. */
export type AutocaptureConfig = {
  /** Include safe text snippets for allowed elements. */
  captureText?: boolean
  /** Element tag names allowed for autocapture, for example `button` or `a`. */
  elementAllowlist?: string[]
  /** CSS selectors allowed for autocapture. */
  cssSelectorAllowlist?: string[]
  /** URL patterns where autocapture is allowed. */
  urlAllowlist?: Array<string | RegExp>
  /** URL patterns where autocapture is blocked. */
  urlIgnorelist?: Array<string | RegExp>
  /** DOM event names to listen for. Defaults to click/change/submit. */
  domEventAllowlist?: Array<'click' | 'change' | 'submit'>
}

/** Browser SDK initialization options. */
export type InitOptions = {
  /** Ingest service base URL, for example `https://analytics.example.com`. */
  apiHost: string
  /** Optional client-supplied API key. Required for no-origin backend calls; optional for allowed-origin browser calls. */
  apiKey?: string
  /** Enable or configure privacy-aware autocapture. */
  autocapture?: boolean | AutocaptureConfig
  /** Capture an initial pageview, no pageviews, or pageviews on history changes. */
  capturePageview?: boolean | 'history_change'
  /** Capture pageleave events always, never, or only when pageview capture is enabled. */
  capturePageleave?: boolean | 'if_capture_pageview'
  /** Browser persistence backend for IDs, session state, and registered properties. */
  persistence?: 'localStorage' | 'memory' | 'localStorage+cookie'
  /** Keep all state in memory for the lifetime of the client instance. */
  disablePersistence?: boolean
  /** Enable batched delivery. */
  requestBatching?: boolean
  /** Number of queued events that triggers an immediate flush. */
  flushAt?: number
  /** Flush interval in milliseconds. */
  flushIntervalMs?: number
  /** Request timeout in milliseconds. */
  requestTimeoutMs?: number
  /** Maximum queued event count before oldest events are dropped. */
  maxQueueSize?: number
  /** Inactivity window after which the next event starts a new session. */
  sessionTimeoutMs?: number
  /** Mutate or drop events before they enter the queue. */
  beforeSend?: BeforeSendHook | BeforeSendHook[]
  /** Property names removed from every event before sending. */
  propertyDenylist?: string[]
  /** Custom delivery implementation. */
  transport?: Transport
}
