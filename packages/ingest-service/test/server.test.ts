import { brotliCompressSync, deflateSync, gzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { loadConfig } from '../src/config.js'
import { MemoryAnalyticsWriter } from '../src/memory-writer.js'
import { createServer } from '../src/server.js'

describe('ingest service', () => {
  let app: FastifyInstance
  let writer: MemoryAnalyticsWriter

  beforeEach(async () => {
    writer = new MemoryAnalyticsWriter()
    app = await createServer({
      config: loadConfig({
        PUBLIC_API_KEYS: 'test_key',
        ALLOWED_ORIGINS: 'http://localhost:3000',
        ALLOW_SERVER_EVENTS_WITHOUT_ORIGIN: 'false'
      }),
      writer
    })
  })

  afterEach(async () => {
    await app.close()
  })

  it('accepts batch events and writes normalized rows', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: {
        api_key: 'test_key',
        batch: [
          {
            event: '$pageview',
            distinct_id: 'anon_1',
            properties: {
              '$session_id': 'session_1',
              '$current_url': 'http://localhost:3000/'
            }
          }
        ]
      }
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      status: 'ok',
      ingested: 1,
      dropped: 0
    })
    expect(writer.events[0]).toMatchObject({
      apiKey: 'test_key',
      event: '$pageview',
      distinctId: 'anon_1',
      personId: expect.any(String),
      sessionId: 'session_1',
      currentUrl: 'http://localhost:3000/'
    })
  })

  it('stores identify aliases before writing the identify event', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/i/v0/e/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: {
        api_key: 'test_key',
        event: '$identify',
        distinct_id: 'user_123',
        properties: {
          '$anon_distinct_id': 'anon_1',
          '$set': {
            email: 'user@example.com'
          }
        }
      }
    })

    expect(response.statusCode).toBe(200)
    const personId = await writer.resolvePersonId('anon_1')
    expect(personId).toEqual(expect.any(String))
    expect(writer.persons.get('user_123')?.properties).toEqual({
      email: 'user@example.com'
    })
  })

  it('stitches pre-identify events in the same batch to the identified person', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: {
        api_key: 'test_key',
        batch: [
          {
            event: 'signup_started',
            distinct_id: 'anon_1'
          },
          {
            event: '$identify',
            distinct_id: 'user_123',
            properties: {
              '$anon_distinct_id': 'anon_1'
            }
          }
        ]
      }
    })

    expect(response.statusCode).toBe(200)
    expect(writer.events).toHaveLength(2)
    expect(writer.events[0].personId).toBe(writer.events[1].personId)
    await expect(writer.resolvePersonId('anon_1')).resolves.toBe(writer.events[1].personId)
    await expect(writer.resolvePersonId('user_123')).resolves.toBe(writer.events[1].personId)
  })

  it('stitches anonymous events from earlier requests when the user is later identified', async () => {
    const anonymousResponse = await app.inject({
      method: 'POST',
      url: '/capture/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: {
        api_key: 'test_key',
        event: 'signup_started',
        distinct_id: 'anon_1'
      }
    })
    const identifyResponse = await app.inject({
      method: 'POST',
      url: '/capture/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: {
        api_key: 'test_key',
        event: '$identify',
        distinct_id: 'user_123',
        properties: {
          '$anon_distinct_id': 'anon_1'
        }
      }
    })

    expect(anonymousResponse.statusCode).toBe(200)
    expect(identifyResponse.statusCode).toBe(200)
    expect(writer.events).toHaveLength(2)
    expect(writer.events[0].personId).toBe(writer.events[1].personId)
    await expect(writer.resolvePersonId('anon_1')).resolves.toBe(writer.events[0].personId)
    await expect(writer.resolvePersonId('user_123')).resolves.toBe(writer.events[0].personId)
  })

  it('preserves set_once person properties across later updates', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/i/v0/e/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: {
        api_key: 'test_key',
        event: '$identify',
        distinct_id: 'user_123',
        properties: {
          '$set_once': {
            first_seen_source: 'landing'
          }
        }
      }
    })
    const second = await app.inject({
      method: 'POST',
      url: '/i/v0/e/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: {
        api_key: 'test_key',
        event: '$set',
        distinct_id: 'user_123',
        properties: {
          '$set_once': {
            first_seen_source: 'pricing'
          },
          '$set': {
            plan: 'pro'
          }
        }
      }
    })

    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(writer.persons.get('user_123')?.properties).toEqual({
      first_seen_source: 'landing',
      plan: 'pro'
    })
  })

  it('rejects unknown api keys and disallowed origins', async () => {
    const badKey = await app.inject({
      method: 'POST',
      url: '/capture/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: {
        api_key: 'bad_key',
        event: 'signup',
        distinct_id: 'user_123'
      }
    })

    expect(badKey.statusCode).toBe(401)

    const badOrigin = await app.inject({
      method: 'POST',
      url: '/capture/',
      headers: {
        origin: 'http://evil.example'
      },
      payload: {
        api_key: 'test_key',
        event: 'signup',
        distinct_id: 'user_123'
      }
    })

    expect(badOrigin.statusCode).toBe(403)
  })

  it('enforces exact origins from ALLOWED_ORIGINS', async () => {
    const wrongScheme = await app.inject({
      method: 'POST',
      url: '/capture/',
      headers: {
        origin: 'https://localhost:3000'
      },
      payload: {
        api_key: 'test_key',
        event: 'wrong_scheme',
        distinct_id: 'user_123'
      }
    })
    const wrongPort = await app.inject({
      method: 'POST',
      url: '/capture/',
      headers: {
        origin: 'http://localhost:3001'
      },
      payload: {
        api_key: 'test_key',
        event: 'wrong_port',
        distinct_id: 'user_123'
      }
    })

    expect(wrongScheme.statusCode).toBe(403)
    expect(wrongPort.statusCode).toBe(403)
  })

  it('returns 400 for malformed JSON and form payloads', async () => {
    const invalidJson = await app.inject({
      method: 'POST',
      url: '/capture/',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json'
      },
      payload: '{"api_key":'
    })
    const invalidText = await app.inject({
      method: 'POST',
      url: '/capture/',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'text/plain'
      },
      payload: '{"api_key":'
    })
    const invalidBase64 = await app.inject({
      method: 'POST',
      url: '/capture/',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/x-www-form-urlencoded'
      },
      payload: new URLSearchParams({ data: 'not-base64!!!' }).toString()
    })
    const invalidBase64Json = await app.inject({
      method: 'POST',
      url: '/capture/',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/x-www-form-urlencoded'
      },
      payload: new URLSearchParams({ data: Buffer.from('{"api_key":').toString('base64') }).toString()
    })

    expect(invalidJson.statusCode).toBe(400)
    expect(invalidText.statusCode).toBe(400)
    expect(invalidBase64.statusCode).toBe(400)
    expect(invalidBase64Json.statusCode).toBe(400)
    expect(writer.events).toHaveLength(0)
  })

  it('accepts gzip-compressed JSON payloads', async () => {
    const payload = JSON.stringify({
      api_key: 'test_key',
      event: 'compressed_event',
      distinct_id: 'user_123'
    })

    const response = await app.inject({
      method: 'POST',
      url: '/capture/',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json',
        'content-encoding': 'gzip'
      },
      payload: gzipSync(payload)
    })

    expect(response.statusCode).toBe(200)
    expect(writer.events[0].event).toBe('compressed_event')
  })

  it('accepts deflate, Brotli, and gzip-js compressed payloads', async () => {
    const payload = JSON.stringify({
      api_key: 'test_key',
      event: 'compressed_event',
      distinct_id: 'user_123'
    })

    const deflateResponse = await app.inject({
      method: 'POST',
      url: '/capture/',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json',
        'content-encoding': 'deflate'
      },
      payload: deflateSync(payload)
    })
    const brResponse = await app.inject({
      method: 'POST',
      url: '/capture/',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json',
        'content-encoding': 'br'
      },
      payload: brotliCompressSync(payload)
    })
    const gzipJsResponse = await app.inject({
      method: 'POST',
      url: '/capture/?compression=gzip-js',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json'
      },
      payload: gzipSync(payload)
    })

    expect(deflateResponse.statusCode).toBe(200)
    expect(brResponse.statusCode).toBe(200)
    expect(gzipJsResponse.statusCode).toBe(200)
    expect(writer.events.filter((event) => event.event === 'compressed_event')).toHaveLength(3)
  })

  it('accepts form-encoded data and raw event arrays', async () => {
    const formPayload = Buffer.from(JSON.stringify({
      api_key: 'test_key',
      event: 'form_encoded_event',
      distinct_id: 'user_123'
    })).toString('base64')

    const formResponse = await app.inject({
      method: 'POST',
      url: '/capture/',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/x-www-form-urlencoded'
      },
      payload: new URLSearchParams({ data: formPayload }).toString()
    })
    const arrayResponse = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: [
        {
          api_key: 'test_key',
          event: 'array_event',
          distinct_id: 'user_456'
        }
      ]
    })

    expect(formResponse.statusCode).toBe(200)
    expect(arrayResponse.statusCode).toBe(200)
    expect(writer.events.map((event) => event.event)).toContain('form_encoded_event')
    expect(writer.events.map((event) => event.event)).toContain('array_event')
  })

  it('rejects invalid timestamps and mixed api keys', async () => {
    const invalidTimestamp = await app.inject({
      method: 'POST',
      url: '/capture/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: {
        api_key: 'test_key',
        event: 'invalid_timestamp',
        distinct_id: 'user_123',
        timestamp: 'not-a-date'
      }
    })
    const mixedKeys = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: {
        api_key: 'test_key',
        batch: [
          {
            event: 'valid',
            distinct_id: 'user_123'
          },
          {
            api_key: 'other_key',
            event: 'wrong_key',
            distinct_id: 'user_456'
          }
        ]
      }
    })

    expect(invalidTimestamp.statusCode).toBe(400)
    expect(mixedKeys.statusCode).toBe(400)
  })

  it('rejects compressed payloads that inflate beyond the body limit', async () => {
    const limitedApp = await createServer({
      config: loadConfig({
        PUBLIC_API_KEYS: 'test_key',
        ALLOWED_ORIGINS: 'http://localhost:3000',
        ALLOW_SERVER_EVENTS_WITHOUT_ORIGIN: 'false',
        MAX_BATCH_BYTES: '80'
      }),
      writer: new MemoryAnalyticsWriter()
    })
    const payload = JSON.stringify({
      api_key: 'test_key',
      event: 'large_compressed_event',
      distinct_id: 'user_123',
      properties: {
        repeated: 'x'.repeat(500)
      }
    })

    const response = await limitedApp.inject({
      method: 'POST',
      url: '/capture/',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json',
        'content-encoding': 'gzip'
      },
      payload: gzipSync(payload)
    })

    expect(response.statusCode).toBe(413)
    await limitedApp.close()
  })

  it('drops invalid events without failing the full batch', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: {
        api_key: 'test_key',
        batch: [
          {
            event: 'valid',
            distinct_id: 'user_123'
          },
          {
            event: 'invalid'
          }
        ]
      }
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      status: 'ok',
      ingested: 1,
      dropped: 1
    })
  })
})
