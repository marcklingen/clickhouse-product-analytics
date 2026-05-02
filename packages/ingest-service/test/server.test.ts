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
        PUBLIC_API_KEYS: 'test_key,other_key',
        ALLOWED_ORIGINS: 'http://localhost:3000'
      }),
      writer
    })
  })

  afterEach(async () => {
    await app.close()
  })

  it('accepts browser-origin batch payloads without api_key', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: {
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
      apiKey: '',
      event: '$pageview',
      distinctId: 'anon_1',
      personId: expect.any(String),
      sessionId: 'session_1',
      currentUrl: 'http://localhost:3000/'
    })
  })

  it('accepts no-origin batch payloads with valid api_key values', async () => {
    const backendWriter = new MemoryAnalyticsWriter()
    const backendApp = await createServer({
      config: loadConfig({
        PUBLIC_API_KEYS: 'primary_key,secondary_key'
      }),
      writer: backendWriter
    })

    const primary = await backendApp.inject({
      method: 'POST',
      url: '/batch/',
      payload: batchPayload('primary_key', {
        event: 'backend_primary',
        distinct_id: 'backend_1'
      })
    })
    const secondary = await backendApp.inject({
      method: 'POST',
      url: '/batch/',
      payload: batchPayload('secondary_key', {
        event: 'backend_secondary',
        distinct_id: 'backend_2'
      })
    })

    expect(primary.statusCode).toBe(200)
    expect(secondary.statusCode).toBe(200)
    expect(backendWriter.events.map((event) => event.event)).toEqual(['backend_primary', 'backend_secondary'])
    await backendApp.close()
  })

  it('rejects no-origin batch payloads without valid api_key values', async () => {
    const backendWriter = new MemoryAnalyticsWriter()
    const backendApp = await createServer({
      config: loadConfig({
        PUBLIC_API_KEYS: 'primary_key'
      }),
      writer: backendWriter
    })

    const missingKey = await backendApp.inject({
      method: 'POST',
      url: '/batch/',
      payload: {
        batch: [
          {
            event: 'backend_missing_key',
            distinct_id: 'backend_1'
          }
        ]
      }
    })
    const invalidKey = await backendApp.inject({
      method: 'POST',
      url: '/batch/',
      payload: batchPayload('invalid_key', {
        event: 'backend_invalid_key',
        distinct_id: 'backend_2'
      })
    })
    const tokenOnly = await backendApp.inject({
      method: 'POST',
      url: '/batch/',
      payload: {
        token: 'primary_key',
        batch: [
          {
            event: 'backend_token_only',
            distinct_id: 'backend_3'
          }
        ]
      }
    })

    expect(missingKey.statusCode).toBe(401)
    expect(invalidKey.statusCode).toBe(401)
    expect(tokenOnly.statusCode).toBe(401)
    expect(backendWriter.events).toHaveLength(0)
    await backendApp.close()
  })

  it('disables no-origin backend ingest when no api keys are configured', async () => {
    const backendApp = await createServer({
      config: loadConfig({}),
      writer: new MemoryAnalyticsWriter()
    })

    const response = await backendApp.inject({
      method: 'POST',
      url: '/batch/',
      payload: batchPayload('unconfigured_key', {
        event: 'backend_disabled',
        distinct_id: 'backend_1'
      })
    })

    expect(response.statusCode).toBe(401)
    await backendApp.close()
  })

  it('does not expose public ingest route aliases', async () => {
    for (const url of ['/batch', '/capture/', '/capture', '/i/v0/e/', '/i/v0/e', '/e/', '/e']) {
      const response = await app.inject({
        method: 'POST',
        url,
        headers: {
          origin: 'http://localhost:3000'
        },
        payload: batchPayload('test_key', {
          event: 'alias_event',
          distinct_id: 'alias_user'
        })
      })

      expect(response.statusCode).toBe(404)
    }
  })

  it('stores identify aliases before writing the identify event', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: batchPayload('test_key', {
        event: '$identify',
        distinct_id: 'user_123',
        properties: {
          '$anon_distinct_id': 'anon_1',
          '$set': {
            email: 'user@example.com'
          }
        }
      })
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
      payload: batchPayload(
        'test_key',
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
      )
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
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: batchPayload('test_key', {
        event: 'signup_started',
        distinct_id: 'anon_1'
      })
    })
    const identifyResponse = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: batchPayload('test_key', {
        event: '$identify',
        distinct_id: 'user_123',
        properties: {
          '$anon_distinct_id': 'anon_1'
        }
      })
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
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: batchPayload('test_key', {
        event: '$identify',
        distinct_id: 'user_123',
        properties: {
          '$set_once': {
            first_seen_source: 'landing'
          }
        }
      })
    })
    const second = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: batchPayload('test_key', {
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
      })
    })

    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(writer.persons.get('user_123')?.properties).toEqual({
      first_seen_source: 'landing',
      plan: 'pro'
    })
  })

  it('keeps person identity global across api keys', async () => {
    const firstKey = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: batchPayload('test_key', {
        event: '$identify',
        distinct_id: 'shared_user',
        properties: {
          '$set': {
            project: 'first'
          }
        }
      })
    })
    const secondKey = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: batchPayload('other_key', {
        event: '$identify',
        distinct_id: 'shared_user',
        properties: {
          '$set': {
            project: 'second'
          }
        }
      })
    })

    expect(firstKey.statusCode).toBe(200)
    expect(secondKey.statusCode).toBe(200)
    expect(writer.events).toHaveLength(2)
    expect(writer.events[0].personId).toBe(writer.events[1].personId)
    await expect(writer.resolvePersonId('shared_user')).resolves.toBe(writer.events[0].personId)
    expect(writer.persons.get('shared_user')?.properties).toEqual({ project: 'second' })
  })

  it('rejects unknown api keys and disallowed origins', async () => {
    const badKey = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: batchPayload('bad_key', {
        event: 'signup',
        distinct_id: 'user_123'
      })
    })

    expect(badKey.statusCode).toBe(401)

    const badOrigin = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://evil.example'
      },
      payload: batchPayload('test_key', {
        event: 'signup',
        distinct_id: 'user_123'
      })
    })

    expect(badOrigin.statusCode).toBe(403)
  })

  it('enforces exact origins from ALLOWED_ORIGINS', async () => {
    const wrongScheme = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'https://localhost:3000'
      },
      payload: batchPayload('test_key', {
        event: 'wrong_scheme',
        distinct_id: 'user_123'
      })
    })
    const wrongPort = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3001'
      },
      payload: batchPayload('test_key', {
        event: 'wrong_port',
        distinct_id: 'user_123'
      })
    })

    expect(wrongScheme.statusCode).toBe(403)
    expect(wrongPort.statusCode).toBe(403)
  })

  it('rejects malformed JSON and non-JSON payload formats', async () => {
    const invalidJson = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json'
      },
      payload: '{"api_key":'
    })
    const textJson = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'text/plain'
      },
      payload: JSON.stringify(batchPayload('test_key', {
        event: 'text_event',
        distinct_id: 'user_123'
      }))
    })
    const formEncoded = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/x-www-form-urlencoded'
      },
      payload: new URLSearchParams({ data: Buffer.from(JSON.stringify(batchPayload('test_key', {
        event: 'form_event',
        distinct_id: 'user_123'
      }))).toString('base64') }).toString()
    })
    const singleEvent = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: {
        api_key: 'test_key',
        event: 'single_event',
        distinct_id: 'user_123'
      }
    })
    const rawArray = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: [
        {
          api_key: 'test_key',
          event: 'array_event',
          distinct_id: 'user_123'
        }
      ]
    })

    expect(invalidJson.statusCode).toBe(400)
    expect(textJson.statusCode).toBe(415)
    expect(formEncoded.statusCode).toBe(415)
    expect(singleEvent.statusCode).toBe(400)
    expect(rawArray.statusCode).toBe(400)
    expect(writer.events).toHaveLength(0)
  })

  it('accepts gzip-compressed JSON batch payloads', async () => {
    const payload = JSON.stringify(batchPayload('test_key', {
      event: 'compressed_event',
      distinct_id: 'user_123'
    }))

    const response = await app.inject({
      method: 'POST',
      url: '/batch/',
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

  it('rejects deflate, Brotli, and gzip-js compressed payloads', async () => {
    const payload = JSON.stringify(batchPayload('test_key', {
      event: 'compressed_event',
      distinct_id: 'user_123'
    }))

    const deflateResponse = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json',
        'content-encoding': 'deflate'
      },
      payload: deflateSync(payload)
    })
    const brResponse = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json',
        'content-encoding': 'br'
      },
      payload: brotliCompressSync(payload)
    })
    const gzipJsResponse = await app.inject({
      method: 'POST',
      url: '/batch/?compression=gzip-js',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json'
      },
      payload: gzipSync(payload)
    })

    expect(deflateResponse.statusCode).toBe(415)
    expect(brResponse.statusCode).toBe(415)
    expect(gzipJsResponse.statusCode).toBe(415)
    expect(writer.events).toHaveLength(0)
  })

  it('rejects invalid timestamps and mixed api keys', async () => {
    const invalidTimestamp = await app.inject({
      method: 'POST',
      url: '/batch/',
      headers: {
        origin: 'http://localhost:3000'
      },
      payload: batchPayload('test_key', {
        event: 'invalid_timestamp',
        distinct_id: 'user_123',
        timestamp: 'not-a-date'
      })
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
        MAX_BATCH_BYTES: '80'
      }),
      writer: new MemoryAnalyticsWriter()
    })
    const payload = JSON.stringify(batchPayload('test_key', {
      event: 'large_compressed_event',
      distinct_id: 'user_123',
      properties: {
        repeated: 'x'.repeat(500)
      }
    }))

    const response = await limitedApp.inject({
      method: 'POST',
      url: '/batch/',
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
      payload: batchPayload(
        'test_key',
        {
          event: 'valid',
          distinct_id: 'user_123'
        },
        {
          event: 'invalid'
        }
      )
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      status: 'ok',
      ingested: 1,
      dropped: 1
    })
  })
})

function batchPayload(apiKey: string, ...events: Array<Record<string, unknown>>): Record<string, unknown> {
  return {
    api_key: apiKey,
    batch: events
  }
}
