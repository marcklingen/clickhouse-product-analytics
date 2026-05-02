import { gunzipSync } from 'node:zlib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClickHouseProductAnalytics, type Transport, type TransportPayload } from '../src/index.js'

describe('ClickHouseProductAnalytics', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('captures pageviews and custom events in analytics batches', async () => {
    const calls: TransportPayload[] = []
    const client = new ClickHouseProductAnalytics()

    client.init({
      apiHost: 'http://localhost:8080',
      apiKey: 'test_key',
      capturePageview: true,
      flushAt: 2,
      flushIntervalMs: 0,
      persistence: 'memory',
      transport: async (_url, payload) => {
        calls.push(payload)
      }
    })

    client.capture('signed up', { plan: 'pro' })
    await client.flush()

    await vi.waitFor(() => {
      expect(calls.flatMap((call) => call.batch)).toHaveLength(2)
    })

    expect(calls[0].api_key).toBe('test_key')
    const events = calls.flatMap((call) => call.batch)
    expect(events[0].event).toBe('$pageview')
    expect(events[1]).toMatchObject({
      event: 'signed up',
      properties: {
        plan: 'pro',
        distinct_id: expect.any(String),
        '$lib': 'clickhouse-product-analytics-js',
        '$lib_version': '0.1.0'
      }
    })
  })

  it('can send browser events without an api key', async () => {
    const calls: Array<{ url: string; payload: TransportPayload }> = []
    const client = new ClickHouseProductAnalytics()

    client.init({
      apiHost: 'http://localhost:8080',
      capturePageview: false,
      flushAt: 10,
      flushIntervalMs: 0,
      persistence: 'memory',
      transport: async (url, payload) => {
        calls.push({ url, payload })
      }
    })

    client.capture('anonymous_browser_event')
    await client.flush()

    expect(calls[0].url).toBe('http://localhost:8080/batch/')
    expect(calls[0].payload.api_key).toBeUndefined()
    expect(calls[0].payload.batch[0].event).toBe('anonymous_browser_event')
  })

  it('ignores removed snake_case config aliases at runtime', () => {
    const client = new ClickHouseProductAnalytics()

    expect(() => client.init({
      api_host: 'http://localhost:8080',
      capture_pageview: false
    } as never)).toThrow('apiHost is required')
  })

  it('connects anonymous and known users with identify', async () => {
    const calls: TransportPayload[] = []
    const client = new ClickHouseProductAnalytics()

    client.init({
      apiHost: 'http://localhost:8080',
      apiKey: 'test_key',
      capturePageview: false,
      flushAt: 10,
      flushIntervalMs: 0,
      persistence: 'memory',
      transport: async (_url, payload) => {
        calls.push(payload)
      }
    })

    const anonymousId = client.get_distinct_id()
    client.identify('user_123', { email: 'user@example.com' })

    await vi.waitFor(() => {
      expect(calls).toHaveLength(1)
    })

    expect(client.get_distinct_id()).toBe('user_123')
    expect(calls[0].batch[0]).toMatchObject({
      event: '$identify',
      properties: {
        distinct_id: 'user_123',
        '$anon_distinct_id': anonymousId,
        '$set': {
          email: 'user@example.com'
        }
      }
    })
  })

  it('requeues events when transport fails', async () => {
    let failed = false
    const client = new ClickHouseProductAnalytics()

    client.init({
      apiHost: 'http://localhost:8080',
      apiKey: 'test_key',
      capturePageview: false,
      flushAt: 10,
      flushIntervalMs: 0,
      persistence: 'memory',
      transport: async () => {
        failed = true
        throw new Error('network unavailable')
      }
    })

    client.capture('checkout')

    await expect(client.flush()).rejects.toThrow('network unavailable')
    expect(failed).toBe(true)

    client.capture('checkout again')
    await expect(client.flush()).rejects.toThrow('network unavailable')
  })

  it('bounds failed retry batches by maxQueueSize', async () => {
    const lifecycle = stubBrowserLifecycle()
    const delivered: string[] = []
    let fail = true
    const client = new ClickHouseProductAnalytics()

    client.init({
      apiHost: 'http://localhost:8080',
      apiKey: 'test_key',
      capturePageview: false,
      flushAt: 10,
      flushIntervalMs: 0,
      maxQueueSize: 2,
      persistence: 'memory',
      transport: async (_url, payload) => {
        if (fail) {
          throw new Error('network unavailable')
        }
        delivered.push(...payload.batch.map((event) => event.event))
      }
    })

    for (const eventName of ['retry_one', 'retry_two', 'retry_three', 'retry_four']) {
      client.capture(eventName)
      await expect(client.flush()).rejects.toThrow('network unavailable')
    }

    fail = false
    lifecycle.pagehide()

    await vi.waitFor(() => {
      expect(delivered).toEqual(['retry_three', 'retry_four'])
    })
    client.shutdown()
  })

  it('includes in-flight batches in unload delivery', async () => {
    const lifecycle = stubBrowserLifecycle()
    const calls: Array<{ payload: TransportPayload; options: Parameters<Transport>[2] }> = []
    let releaseFirstTransport: (() => void) | undefined
    const client = new ClickHouseProductAnalytics()

    client.init({
      apiHost: 'http://localhost:8080',
      apiKey: 'test_key',
      capturePageview: false,
      flushAt: 10,
      flushIntervalMs: 0,
      persistence: 'memory',
      transport: async (_url, payload, options) => {
        calls.push({ payload, options })
        if (calls.length === 1) {
          await new Promise<void>((resolve) => {
            releaseFirstTransport = resolve
          })
        }
      }
    })

    client.capture('pending_event')
    const flushPromise = client.flush()

    await vi.waitFor(() => {
      expect(calls).toHaveLength(1)
    })
    lifecycle.pagehide()

    await vi.waitFor(() => {
      expect(calls).toHaveLength(2)
    })
    expect(calls[1].options.transport).toBe('sendBeacon')
    expect(calls[1].payload.batch.map((event) => event.event)).toEqual(['pending_event'])

    releaseFirstTransport?.()
    await flushPromise
    client.shutdown()
  })

  it('runs beforeSend and propertyDenylist hooks', async () => {
    const calls: TransportPayload[] = []
    const client = new ClickHouseProductAnalytics()

    client.init('test_key', {
      apiHost: 'http://localhost:8080',
      capturePageview: false,
      flushAt: 1,
      flushIntervalMs: 0,
      persistence: 'memory',
      propertyDenylist: ['secret'],
      beforeSend: (event) => ({
        ...event,
        properties: {
          ...event.properties,
          added: true
        }
      }),
      transport: async (_url, payload) => {
        calls.push(payload)
      }
    })

    client.capture('event', { secret: 'drop me' })

    await vi.waitFor(() => {
      expect(calls).toHaveLength(1)
    })

    expect(calls[0].batch[0].properties.secret).toBeUndefined()
    expect(calls[0].batch[0].properties.added).toBe(true)
  })

  it('applies the property denylist after beforeSend hooks', async () => {
    const calls: TransportPayload[] = []
    const client = new ClickHouseProductAnalytics()

    client.init('test_key', {
      apiHost: 'http://localhost:8080',
      capturePageview: false,
      flushAt: 1,
      flushIntervalMs: 0,
      persistence: 'memory',
      propertyDenylist: ['secret'],
      beforeSend: (event) => ({
        ...event,
        properties: {
          ...event.properties,
          secret: 'reintroduced'
        }
      }),
      transport: async (_url, payload) => {
        calls.push(payload)
      }
    })

    client.capture('event')

    await vi.waitFor(() => {
      expect(calls).toHaveLength(1)
    })

    expect(calls[0].batch[0].properties.secret).toBeUndefined()
  })

  it('falls back when localStorage access throws', async () => {
    const calls: TransportPayload[] = []
    const client = new ClickHouseProductAnalytics()

    vi.stubGlobal('window', {
      location: {
        href: 'http://localhost:3000/test',
        host: 'localhost:3000',
        pathname: '/test'
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      get localStorage() {
        throw new Error('blocked')
      }
    })
    vi.stubGlobal('document', {
      cookie: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      referrer: '',
      title: 'Test page',
      visibilityState: 'visible'
    })

    client.init({
      apiHost: 'http://localhost:8080',
      apiKey: 'test_key',
      capturePageview: false,
      flushAt: 1,
      flushIntervalMs: 0,
      persistence: 'localStorage+cookie',
      transport: async (_url, payload) => {
        calls.push(payload)
      }
    })

    client.capture('fallback_storage_event')

    await vi.waitFor(() => {
      expect(calls).toHaveLength(1)
    })
    expect(calls[0].batch[0].event).toBe('fallback_storage_event')
    client.shutdown()
  })

  it('sanitizes circular and bigint properties before enqueueing', async () => {
    const calls: TransportPayload[] = []
    const circular: Record<string, unknown> = {
      nested: {}
    }
    circular.self = circular
    const client = new ClickHouseProductAnalytics()

    client.init({
      apiHost: 'http://localhost:8080',
      apiKey: 'test_key',
      capturePageview: false,
      flushAt: 1,
      flushIntervalMs: 0,
      persistence: 'memory',
      transport: async (_url, payload) => {
        calls.push(payload)
      }
    })

    client.capture('safe_properties', {
      amount: 10n,
      circular
    })

    await vi.waitFor(() => {
      expect(calls).toHaveLength(1)
    })

    expect(calls[0].batch[0].properties.amount).toBe('10')
    expect(calls[0].batch[0].properties.circular).toMatchObject({
      self: '[Circular]'
    })
  })

  it('preserves explicit original IDs for alias events', async () => {
    const calls: TransportPayload[] = []
    const client = new ClickHouseProductAnalytics()

    client.init({
      apiHost: 'http://localhost:8080',
      apiKey: 'test_key',
      capturePageview: false,
      flushAt: 1,
      flushIntervalMs: 0,
      persistence: 'memory',
      transport: async (_url, payload) => {
        calls.push(payload)
      }
    })

    client.alias('new_id', 'old_id')

    await vi.waitFor(() => {
      expect(calls).toHaveLength(1)
    })

    expect(calls[0].batch[0]).toMatchObject({
      event: '$create_alias',
      properties: {
        alias: 'new_id',
        distinct_id: 'old_id'
      }
    })
  })

  it('only captures pageleave by default when pageview capture is enabled', async () => {
    const calls: TransportPayload[] = []
    const lifecycle = stubBrowserLifecycle()
    const client = new ClickHouseProductAnalytics()

    client.init({
      apiHost: 'http://localhost:8080',
      apiKey: 'test_key',
      capturePageview: false,
      persistence: 'memory',
      transport: async (_url, payload) => {
        calls.push(payload)
      }
    })

    lifecycle.pagehide()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(calls).toHaveLength(0)
    client.shutdown()
  })

  it('captures at most one pageleave across unload lifecycle events', async () => {
    const calls: TransportPayload[] = []
    const lifecycle = stubBrowserLifecycle()
    const client = new ClickHouseProductAnalytics()

    client.init({
      apiHost: 'http://localhost:8080',
      apiKey: 'test_key',
      capturePageview: false,
      capturePageleave: true,
      persistence: 'memory',
      transport: async (_url, payload) => {
        calls.push(payload)
      }
    })

    lifecycle.pagehide()
    lifecycle.beforeunload()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(calls).toHaveLength(1)
    expect(calls[0].batch[0].event).toBe('$pageleave')
    client.shutdown()
  })

  it('captures pageleave again after visibility is restored', async () => {
    const calls: TransportPayload[] = []
    const lifecycle = stubBrowserLifecycle()
    const client = new ClickHouseProductAnalytics()

    client.init({
      apiHost: 'http://localhost:8080',
      apiKey: 'test_key',
      capturePageview: false,
      capturePageleave: true,
      persistence: 'memory',
      transport: async (_url, payload) => {
        calls.push(payload)
      }
    })

    lifecycle.visibilitychange('hidden')
    await vi.waitFor(() => {
      expect(calls).toHaveLength(1)
    })
    lifecycle.visibilitychange('visible')
    lifecycle.visibilitychange('hidden')

    await vi.waitFor(() => {
      expect(calls).toHaveLength(2)
    })
    expect(calls.map((call) => call.batch[0].event)).toEqual(['$pageleave', '$pageleave'])
    client.shutdown()
  })

  it('falls back to fetch when sendBeacon rejects an unload payload', async () => {
    const lifecycle = stubBrowserLifecycle()
    const sendBeacon = vi.fn(() => false)
    const fetch = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('navigator', {
      sendBeacon,
      onLine: true
    })
    vi.stubGlobal('fetch', fetch)

    const client = new ClickHouseProductAnalytics()
    client.init({
      apiHost: 'http://localhost:8080',
      apiKey: 'test_key',
      capturePageview: false,
      capturePageleave: true,
      persistence: 'memory'
    })

    lifecycle.pagehide()

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
    })
    expect(sendBeacon).toHaveBeenCalledTimes(1)
    client.shutdown()
  })

  it('gzip-compresses fetch payloads when browser compression is available', async () => {
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toContain('ver=0.1.0')
      expect(init?.headers).toMatchObject({
        'content-type': 'application/json',
        'content-encoding': 'gzip'
      })
      expect(init?.body).toBeInstanceOf(ArrayBuffer)

      const decoded = gunzipSync(Buffer.from(init!.body as ArrayBuffer)).toString('utf8')
      const payload = JSON.parse(decoded) as TransportPayload
      expect(payload.batch[0].event).toBe('compressed_event')

      return new Response(null, { status: 200 })
    })
    vi.stubGlobal('fetch', fetch)

    const client = new ClickHouseProductAnalytics()
    client.init({
      apiHost: 'http://localhost:8080',
      apiKey: 'test_key',
      capturePageview: false,
      flushAt: 10,
      flushIntervalMs: 0,
      persistence: 'memory'
    })

    client.capture('compressed_event')
    await client.flush()

    expect(fetch).toHaveBeenCalledTimes(1)
    client.shutdown()
  })

  it('does not retry permanent HTTP errors from the default transport', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 401 }))
    vi.stubGlobal('fetch', fetch)

    const client = new ClickHouseProductAnalytics()
    client.init({
      apiHost: 'http://localhost:8080',
      apiKey: 'test_key',
      capturePageview: false,
      flushAt: 10,
      flushIntervalMs: 0,
      persistence: 'memory'
    })

    client.capture('unauthorized_event')
    await expect(client.flush()).rejects.toThrow('HTTP 401')
    await expect(client.flush()).resolves.toBeUndefined()

    expect(fetch).toHaveBeenCalledTimes(1)
    client.shutdown()
  })

  it('splits oversized batches when the server returns 413', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: fetch.mock.calls.length === 1 ? 413 : 200 }))
    vi.stubGlobal('fetch', fetch)

    const client = new ClickHouseProductAnalytics()
    client.init({
      apiHost: 'http://localhost:8080',
      apiKey: 'test_key',
      capturePageview: false,
      flushAt: 10,
      flushIntervalMs: 0,
      persistence: 'memory'
    })

    client.capture('first_event')
    client.capture('second_event')
    await client.flush()

    expect(fetch).toHaveBeenCalledTimes(3)
    client.shutdown()
  })
})

function stubBrowserLifecycle(): {
  pagehide: () => void
  beforeunload: () => void
  pageshow: () => void
  visibilitychange: (visibilityState: 'hidden' | 'visible') => void
} {
  const listeners = new Map<string, Array<() => void>>()
  const addEventListener = (event: string, listener: () => void): void => {
    listeners.set(event, [...(listeners.get(event) ?? []), listener])
  }
  const removeEventListener = (event: string, listener: () => void): void => {
    listeners.set(event, (listeners.get(event) ?? []).filter((item) => item !== listener))
  }
  const documentStub = {
    addEventListener,
    removeEventListener,
    referrer: '',
    title: 'Test page',
    visibilityState: 'visible'
  }

  vi.stubGlobal('window', {
    addEventListener,
    removeEventListener,
    navigator: {
      onLine: true
    },
    location: {
      href: 'http://localhost:3000/test',
      host: 'localhost:3000',
      pathname: '/test'
    }
  })
  vi.stubGlobal('document', documentStub)

  return {
    pagehide: () => {
      for (const listener of listeners.get('pagehide') ?? []) {
        listener()
      }
    },
    beforeunload: () => {
      for (const listener of listeners.get('beforeunload') ?? []) {
        listener()
      }
    },
    pageshow: () => {
      for (const listener of listeners.get('pageshow') ?? []) {
        listener()
      }
    },
    visibilitychange: (visibilityState: 'hidden' | 'visible') => {
      documentStub.visibilityState = visibilityState
      for (const listener of listeners.get('visibilitychange') ?? []) {
        listener()
      }
    }
  }
}
