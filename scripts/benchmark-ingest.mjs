import { createServer as createHttpServer } from 'node:http'
import { once } from 'node:events'
import { performance } from 'node:perf_hooks'
import { applyIdentitySideEffects, normalizeEvents, parsePayload } from '../packages/ingest-service/dist/payload.js'
import { loadConfig } from '../packages/ingest-service/dist/config.js'
import { createServer as createFastifyServer } from '../packages/ingest-service/dist/server.js'
import { MemoryAnalyticsWriter } from '../packages/ingest-service/dist/memory-writer.js'

const requestCount = Number(process.env.CPA_BENCH_REQUESTS ?? 300)
const batchSize = Number(process.env.CPA_BENCH_BATCH_SIZE ?? 100)
const concurrency = Number(process.env.CPA_BENCH_CONCURRENCY ?? 30)
const totalEvents = requestCount * batchSize

const config = loadConfig({
  PUBLIC_API_KEYS: 'bench_key',
  MAX_EVENTS_PER_BATCH: String(Math.max(10_000, batchSize)),
  MAX_BATCH_BYTES: String(20 * 1024 * 1024)
})

const fastify = await createFastifyServer({
  config,
  writer: new MemoryAnalyticsWriter()
})
const fastifyUrl = await listenFastify(fastify)
const native = createNativeServer(new MemoryAnalyticsWriter())
const nativeUrl = await listenNative(native)

try {
  const fastifyResult = await runBenchmark('fastify', fastifyUrl)
  const nativeResult = await runBenchmark('native-http-candidate', nativeUrl)

  console.log(JSON.stringify({
    requestCount,
    batchSize,
    concurrency,
    totalEvents,
    results: [
      fastifyResult,
      nativeResult
    ],
    fastest: fastifyResult.eventsPerSecond >= nativeResult.eventsPerSecond ? 'fastify' : 'native-http-candidate'
  }, null, 2))
} finally {
  await fastify.close()
  native.close()
}

async function runBenchmark(name, baseUrl) {
  const started = performance.now()
  let next = 0

  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < requestCount) {
      const requestIndex = next
      next += 1
      await postBatch(baseUrl, requestIndex)
    }
  }))

  const durationMs = performance.now() - started
  return {
    name,
    durationMs: Number(durationMs.toFixed(2)),
    requestsPerSecond: Number((requestCount / (durationMs / 1000)).toFixed(2)),
    eventsPerSecond: Number((totalEvents / (durationMs / 1000)).toFixed(2))
  }
}

async function postBatch(baseUrl, requestIndex) {
  const response = await fetch(`${baseUrl}/batch/`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      api_key: 'bench_key',
      batch: Array.from({ length: batchSize }, (_value, eventIndex) => ({
        event: 'benchmark_event',
        distinct_id: `bench_user_${requestIndex}_${eventIndex}`,
        properties: {
          run_id: 'local_benchmark',
          request_index: requestIndex,
          event_index: eventIndex,
          '$session_id': `session_${requestIndex}`
        }
      }))
    })
  })
  if (!response.ok) {
    throw new Error(`${baseUrl} returned HTTP ${response.status}: ${await response.text()}`)
  }
}

async function listenFastify(app) {
  await app.listen({ host: '127.0.0.1', port: 0 })
  const address = app.server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Fastify did not expose a TCP address')
  }
  return `http://127.0.0.1:${address.port}`
}

async function listenNative(server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Native server did not expose a TCP address')
  }
  return `http://127.0.0.1:${address.port}`
}

function createNativeServer(writer) {
  return createHttpServer(async (request, response) => {
    try {
      if (request.method === 'GET' && request.url === '/health') {
        sendJson(response, 200, { ok: true })
        return
      }
      if (request.method !== 'POST' || !['/batch/', '/batch', '/capture/', '/capture', '/i/v0/e/', '/i/v0/e', '/e/', '/e'].includes(request.url ?? '')) {
        sendJson(response, 404, { status: 'error', error: 'Not found' })
        return
      }

      const body = await readBody(request)
      const parsed = parsePayload(JSON.parse(body))
      if (!config.publicApiKeys.has(parsed.apiKey)) {
        sendJson(response, 401, { status: 'error', error: 'Invalid api_key' })
        return
      }
      if (parsed.events.length > config.maxEventsPerBatch) {
        sendJson(response, 413, {
          status: 'error',
          error: `Batch has ${parsed.events.length} events, maximum is ${config.maxEventsPerBatch}`
        })
        return
      }

      const { events, dropped } = await normalizeEvents(writer, parsed.apiKey, parsed.events, {
        ip: request.socket.remoteAddress ?? '',
        headers: request.headers
      })
      for (const event of events) {
        await applyIdentitySideEffects(writer, event)
      }
      await writer.writeEvents(events)
      sendJson(response, 200, { status: 'ok', ingested: events.length, dropped })
    } catch (error) {
      sendJson(response, 500, {
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      })
    }
  })
}

async function readBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > config.maxBatchBytes) {
      throw new Error('Request body is too large')
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'content-type': 'application/json'
  })
  response.end(JSON.stringify(body))
}
