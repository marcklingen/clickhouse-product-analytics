import { createGunzip } from 'node:zlib'
import cors from '@fastify/cors'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import type { ServiceConfig } from './config.js'
import { PayloadDecodeError, applyIdentitySideEffects, normalizeEvents, parsePayload } from './payload.js'
import type { AnalyticsWriter } from './types.js'

export type CreateServerOptions = {
  config: ServiceConfig
  writer: AnalyticsWriter
}

export async function createServer({ config, writer }: CreateServerOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.logLevel === 'silent' ? false : { level: config.logLevel },
    bodyLimit: config.maxBatchBytes,
    trustProxy: true
  })

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true)
        return
      }
      callback(null, isAllowedOrigin(config, origin))
    },
    methods: ['POST', 'OPTIONS', 'GET'],
    allowedHeaders: ['content-type', 'content-encoding', 'x-requested-with']
  })

  app.addHook('preParsing', async (request, _reply, payload) => {
    const encoding = String(request.headers['content-encoding'] ?? 'identity').toLowerCase()
    if (typeof request.query === 'object' && request.query && 'compression' in request.query) {
      throw unsupportedMediaError('The compression query parameter is not supported. Use Content-Encoding: gzip.')
    }
    if (encoding === 'gzip') {
      return withEncodedLength(payload.pipe(createGunzip()), request.headers['content-length'])
    }
    if (encoding !== 'identity') {
      throw unsupportedMediaError(`Unsupported content-encoding: ${encoding}`)
    }
    return payload
  })

  app.get('/health', async () => ({
    ok: true
  }))

  const ingest = async (request: FastifyRequest, reply: FastifyReply) => {
    const contentType = String(request.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
    if (contentType !== 'application/json') {
      return reply.code(415).send({
        status: 'error',
        error: 'Unsupported content type. Use application/json.'
      })
    }

    const parsed = parsePayload(request.body)
    const authorization = authorizeRequest(config, request.headers.origin, parsed.apiKey)
    if (!authorization.ok) {
      return reply.code(authorization.statusCode).send({
        status: 'error',
        error: authorization.error
      })
    }
    if (parsed.events.length > config.maxEventsPerBatch) {
      return reply.code(413).send({
        status: 'error',
        error: `Batch has ${parsed.events.length} events, maximum is ${config.maxEventsPerBatch}`
      })
    }

    const { events, dropped } = await normalizeEvents(writer, parsed.apiKey, parsed.events, request)
    for (const event of events) {
      await applyIdentitySideEffects(writer, event)
    }
    await writer.writeEvents(events)

    return reply.send({
      status: 'ok',
      ingested: events.length,
      dropped
    })
  }

  app.post('/batch/', ingest)

  app.setErrorHandler((error, _request, reply) => {
    const message = error instanceof Error ? error.message : String(error)
    const statusCode = typeof (error as { statusCode?: unknown }).statusCode === 'number'
      ? (error as { statusCode: number }).statusCode
      : undefined
    if (error instanceof ZodError) {
      return reply.code(400).send({
        status: 'error',
        error: error.errors.map((issue) => issue.message).join('; ')
      })
    }
    if (message.includes('api_key') || message.includes('distinct_id') || message.includes('timestamp') || message.includes('Mixed api_key')) {
      return reply.code(400).send({
        status: 'error',
        error: message
      })
    }
    if (error instanceof PayloadDecodeError || statusCode === 400) {
      return reply.code(400).send({
        status: 'error',
        error: error instanceof PayloadDecodeError ? error.message : message
      })
    }
    if (statusCode === 415) {
      return reply.code(415).send({
        status: 'error',
        error: message
      })
    }
    if (message.includes('Origin is not allowed')) {
      return reply.code(403).send({
        status: 'error',
        error: message
      })
    }
    if (statusCode === 413) {
      return reply.code(413).send({
        status: 'error',
        error: `Request body exceeds MAX_BATCH_BYTES (${config.maxBatchBytes})`
      })
    }
    app.log.error(error)
    return reply.code(500).send({
      status: 'error',
      error: 'Internal server error'
    })
  })

  app.addHook('onClose', async () => {
    await writer.close()
  })

  return app
}

function authorizeRequest(config: ServiceConfig, origin: string | undefined, apiKey: string | undefined): { ok: true } | { ok: false; statusCode: 401 | 403; error: string } {
  if (origin) {
    if (!isAllowedOrigin(config, origin)) {
      return {
        ok: false,
        statusCode: 403,
        error: 'Origin is not allowed'
      }
    }
    if (apiKey && !config.publicApiKeys.has(apiKey)) {
      return {
        ok: false,
        statusCode: 401,
        error: 'Invalid api_key'
      }
    }
    return { ok: true }
  }

  if (!apiKey || !config.publicApiKeys.has(apiKey)) {
    return {
      ok: false,
      statusCode: 401,
      error: 'Invalid api_key'
    }
  }
  return { ok: true }
}

function isAllowedOrigin(config: ServiceConfig, origin: string): boolean {
  return config.allowedOrigins.has(origin)
}

function withEncodedLength<T extends NodeJS.ReadableStream>(stream: T, contentLength: string | undefined): T {
  ;(stream as T & { receivedEncodedLength?: number }).receivedEncodedLength = Number(contentLength ?? 0)
  return stream
}

function unsupportedMediaError(message: string): Error & { statusCode: 415 } {
  const error = new Error(message) as Error & { statusCode: 415 }
  error.statusCode = 415
  return error
}
