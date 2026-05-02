// @vitest-environment jsdom

import React, { StrictMode, useEffect } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClickHouseProductAnalytics, createClient } from '@clickhouse-product-analytics/sdk'
import {
  AnalyticsCaptureOnViewed,
  AnalyticsProvider,
  useAnalytics,
  type AnalyticsClient
} from '../src/index.js'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('React bindings', () => {
  it('does not initialize managed clients during server render', () => {
    function Probe() {
      return <span>{useAnalytics() ? 'ready' : 'missing'}</span>
    }

    const html = renderToString(
      <AnalyticsProvider options={{ api_host: 'http://127.0.0.1:8080' }}>
        <Probe />
      </AnalyticsProvider>
    )

    expect(html).toContain('missing')
  })

  it('returns the provided client from the hook', () => {
    const client = createClient()
    let seenClient: AnalyticsClient | undefined

    function Probe() {
      seenClient = useAnalytics()
      return null
    }

    renderToString(
      <AnalyticsProvider client={client}>
        <Probe />
      </AnalyticsProvider>
    )

    expect(seenClient).toBe(client)
  })

  it('initializes a managed client only once under StrictMode', async () => {
    const initSpy = vi.spyOn(ClickHouseProductAnalytics.prototype, 'init')
    const shutdownSpy = vi.spyOn(ClickHouseProductAnalytics.prototype, 'shutdown')

    const view = renderClient(
      <StrictMode>
        <AnalyticsProvider
          options={{
            api_host: 'http://127.0.0.1:8080',
            capture_pageview: false,
            persistence: 'memory'
          }}
        >
          <div />
        </AnalyticsProvider>
      </StrictMode>
    )

    expect(initSpy).toHaveBeenCalledTimes(1)
    view.unmount()
    await waitForTimers()
    expect(shutdownSpy).toHaveBeenCalledTimes(1)
  })

  it('warns and keeps the existing managed client when apiKey changes', () => {
    const initSpy = vi.spyOn(ClickHouseProductAnalytics.prototype, 'init')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    act(() => {
      root.render(
        <AnalyticsProvider
          apiKey="first_key"
          options={{
            api_host: 'http://127.0.0.1:8080',
            capture_pageview: false,
            persistence: 'memory'
          }}
        />
      )
    })

    act(() => {
      root.render(
        <AnalyticsProvider
          apiKey="second_key"
          options={{
            api_host: 'http://127.0.0.1:8080',
            capture_pageview: false,
            persistence: 'memory'
          }}
        />
      )
    })

    expect(initSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Changing `apiKey`'))
    act(() => root.unmount())
  })

  it('returns undefined outside a provider', () => {
    let seenClient: AnalyticsClient | undefined

    function Probe() {
      seenClient = useAnalytics()
      return null
    }

    renderToString(<Probe />)
    expect(seenClient).toBeUndefined()
  })

  it('captures an event when a viewed component mounts without IntersectionObserver support', async () => {
    const capture = vi.fn()
    const client = { capture } as unknown as AnalyticsClient

    renderClient(
      <AnalyticsProvider client={client}>
        <AnalyticsCaptureOnViewed name="hero" properties={{ slot: 'top' }}>
          <span>Hero</span>
        </AnalyticsCaptureOnViewed>
      </AnalyticsProvider>
    )

    await waitForTimers()
    expect(capture).toHaveBeenCalledWith('$element_viewed', {
      element_name: 'hero',
      slot: 'top'
    })
  })

  it('captures a viewed event when IntersectionObserver reports visibility', async () => {
    const capture = vi.fn()
    const disconnect = vi.fn()
    const observe = vi.fn()
    const client = { capture } as unknown as AnalyticsClient
    let observerCallback: IntersectionObserverCallback | undefined

    vi.stubGlobal('IntersectionObserver', class {
      readonly root = null
      readonly rootMargin = ''
      readonly thresholds = []
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback
      }
      observe = observe
      unobserve = vi.fn()
      disconnect = disconnect
      takeRecords = () => []
    })

    renderClient(
      <AnalyticsProvider client={client}>
        <AnalyticsCaptureOnViewed name="hero" properties={{ slot: 'top' }}>
          <span>Hero</span>
        </AnalyticsCaptureOnViewed>
      </AnalyticsProvider>
    )

    await waitForTimers()
    expect(observe).toHaveBeenCalledTimes(1)
    expect(capture).not.toHaveBeenCalled()

    act(() => {
      observerCallback?.([
        {
          isIntersecting: true
        } as IntersectionObserverEntry
      ], {} as IntersectionObserver)
    })

    expect(capture).toHaveBeenCalledWith('$element_viewed', {
      element_name: 'hero',
      slot: 'top'
    })
    expect(disconnect).toHaveBeenCalled()
  })

  it('lets components call capture and identify from the hook', async () => {
    const capture = vi.fn()
    const identify = vi.fn()
    const client = { capture, identify } as unknown as AnalyticsClient

    function CaptureProbe() {
      const analytics = useAnalytics()
      useEffect(() => {
        analytics?.capture('button_clicked', { source: 'test' })
        analytics?.identify('user_123')
      }, [analytics])
      return null
    }

    renderClient(
      <AnalyticsProvider client={client}>
        <CaptureProbe />
      </AnalyticsProvider>
    )

    await waitForTimers()
    expect(capture).toHaveBeenCalledWith('button_clicked', { source: 'test' })
    expect(identify).toHaveBeenCalledWith('user_123')
  })
})

function renderClient(element: React.ReactElement): { root: Root; unmount: () => void } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(element)
  })
  return {
    root,
    unmount: () => {
      act(() => root.unmount())
    }
  }
}

async function waitForTimers(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5))
  })
}
