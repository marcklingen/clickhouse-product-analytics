'use client'

import React, {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode
} from 'react'
import { createClient, type ClickHouseProductAnalytics, type InitOptions } from '@clickhouse-product-analytics/sdk'

/** Analytics client returned by the React hook and accepted by the provider. */
export type AnalyticsClient = ClickHouseProductAnalytics

type ProviderContext = {
  client: AnalyticsClient | undefined
}

/** React context that stores the active analytics client. Prefer `useAnalytics()` in application code. */
export const AnalyticsContext = createContext<ProviderContext>({ client: undefined })

type WithChildren<T> = T & {
  children?: ReactNode
}

/** Props for `AnalyticsProvider`. Pass either managed options with an optional API key or an explicit client. */
export type AnalyticsProviderProps = WithChildren<
  | {
      client: AnalyticsClient
      apiKey?: never
      options?: never
    }
  | {
      apiKey?: string
      options: Omit<InitOptions, 'apiKey'>
      client?: never
    }
>

type PreviousInitialization = {
  apiKey?: string
  optionsKey: string
}

/** Initialize or provide an analytics client for descendant React components. */
export function AnalyticsProvider({ children, client, apiKey, options }: AnalyticsProviderProps): React.JSX.Element {
  const [activeClient, setActiveClient] = useState<AnalyticsClient | undefined>(client)
  const ownedClientRef = useRef<AnalyticsClient | undefined>(undefined)
  const previousInitializationRef = useRef<PreviousInitialization | undefined>(undefined)
  const shutdownTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const apiKeyWarningRef = useRef(false)
  const optionsWarningRef = useRef(false)
  const optionsKey = safeStableKey(options)

  useEffect(() => {
    if (shutdownTimerRef.current) {
      clearTimeout(shutdownTimerRef.current)
      shutdownTimerRef.current = undefined
    }

    if (client) {
      if (ownedClientRef.current) {
        ownedClientRef.current.shutdown()
        ownedClientRef.current = undefined
        previousInitializationRef.current = undefined
      }
      setActiveClient(client)
      return undefined
    }

    const previous = previousInitializationRef.current
    if (previous && ownedClientRef.current) {
      if (apiKey !== previous.apiKey && !apiKeyWarningRef.current) {
        console.warn(
          '[ClickHouseProductAnalytics] Changing `apiKey` after AnalyticsProvider has initialized is not supported. Remount the provider or pass an explicitly managed client instead.'
        )
        apiKeyWarningRef.current = true
      }
      if (optionsKey !== previous.optionsKey && !optionsWarningRef.current) {
        console.warn(
          '[ClickHouseProductAnalytics] Changing AnalyticsProvider `options` after initialization is not supported. Remount the provider or pass an explicitly managed client instead.'
        )
        optionsWarningRef.current = true
      }
      setActiveClient(ownedClientRef.current)
      return scheduleOwnedShutdown
    }

    const ownedClient = createClient()
    if (apiKey) {
      ownedClient.init(apiKey, options)
    } else {
      ownedClient.init(options)
    }
    ownedClientRef.current = ownedClient
    previousInitializationRef.current = { apiKey, optionsKey }
    setActiveClient(ownedClient)

    return scheduleOwnedShutdown

    function scheduleOwnedShutdown(): void {
      shutdownTimerRef.current = setTimeout(() => {
        ownedClientRef.current?.shutdown()
        ownedClientRef.current = undefined
        previousInitializationRef.current = undefined
        shutdownTimerRef.current = undefined
      }, 0)
    }
  }, [apiKey, client, optionsKey])

  const value = useMemo(() => ({ client: activeClient }), [activeClient])

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>
}

/** Return the current analytics client, or `undefined` outside a provider or before browser initialization. */
export function useAnalytics(): AnalyticsClient | undefined {
  return useContext(AnalyticsContext).client
}

/** Props for `AnalyticsCaptureOnViewed`, a viewport-impression helper. */
export type AnalyticsCaptureOnViewedProps = HTMLAttributes<HTMLDivElement> & {
  /** Stable name for the viewed element. Sent as `element_name`. */
  name?: string
  /** Additional event properties attached to each impression event. */
  properties?: Record<string, unknown>
  /** IntersectionObserver options used to decide when the element is viewed. */
  observerOptions?: IntersectionObserverInit
  /** Track each child separately instead of the wrapper as one impression. */
  trackAllChildren?: boolean
  /** Event name to capture when viewed. Defaults to `$element_viewed`. */
  eventName?: string
  /** Explicit key used to reset one-shot tracking when props change. */
  trackingKey?: string
}

/** Capture one event when wrapped content enters the viewport. */
export function AnalyticsCaptureOnViewed({
  name,
  properties,
  observerOptions,
  trackAllChildren,
  eventName = '$element_viewed',
  trackingKey,
  children,
  ...props
}: AnalyticsCaptureOnViewedProps): React.JSX.Element {
  if (trackAllChildren) {
    const trackedChildren = Children.map(children, (child, index) => (
      <ViewedTracker
        key={index}
        name={name}
        properties={{ ...properties, child_index: index }}
        observerOptions={observerOptions}
        eventName={eventName}
        trackingKey={`${trackingKey ?? viewedTrackingKey(eventName, name, properties)}:${index}`}
      >
        {child}
      </ViewedTracker>
    ))
    return <div {...props}>{trackedChildren}</div>
  }

  return (
    <ViewedTracker
      name={name}
      properties={properties}
      observerOptions={observerOptions}
      eventName={eventName}
      trackingKey={trackingKey ?? viewedTrackingKey(eventName, name, properties)}
      {...props}
    >
      {children}
    </ViewedTracker>
  )
}

type ViewedTrackerProps = HTMLAttributes<HTMLDivElement> & {
  name?: string
  properties?: Record<string, unknown>
  observerOptions?: IntersectionObserverInit
  eventName: string
  trackingKey: string
}

function ViewedTracker({
  name,
  properties,
  observerOptions,
  eventName,
  trackingKey,
  children,
  ...props
}: ViewedTrackerProps): React.JSX.Element {
  const client = useAnalytics()
  const elementRef = useRef<HTMLDivElement | null>(null)
  const trackedRef = useRef(false)
  const lastTrackingKeyRef = useRef(trackingKey)

  useEffect(() => {
    if (lastTrackingKeyRef.current !== trackingKey) {
      trackedRef.current = false
      lastTrackingKeyRef.current = trackingKey
    }
  }, [trackingKey])

  const captureViewed = useCallback(() => {
    if (!client || trackedRef.current) {
      return
    }
    trackedRef.current = true
    client.capture(eventName, {
      element_name: name,
      ...properties
    })
  }, [client, eventName, name, properties])

  useEffect(() => {
    const element = elementRef.current
    if (!element || trackedRef.current) {
      return undefined
    }

    if (typeof IntersectionObserver === 'undefined') {
      captureViewed()
      return undefined
    }

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0]
      if (entry?.isIntersecting) {
        captureViewed()
        observer.disconnect()
      }
    }, observerOptions)

    observer.observe(element)
    return () => observer.disconnect()
  }, [captureViewed, observerOptions])

  return (
    <div ref={elementRef} {...props}>
      {children}
    </div>
  )
}

function viewedTrackingKey(eventName: string, name: string | undefined, properties: Record<string, unknown> | undefined): string {
  return safeStableKey([eventName, name, properties ?? {}])
}

function safeStableKey(value: unknown): string {
  const seen = new WeakSet<object>()
  try {
    return JSON.stringify(value ?? {}, (_key, item) => {
      if (typeof item === 'function') {
        return '[function]'
      }
      if (typeof item === 'object' && item !== null) {
        if (seen.has(item)) {
          return '[circular]'
        }
        seen.add(item)
      }
      return item
    }) ?? '{}'
  } catch {
    return '[unserializable]'
  }
}
