import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { FastifyRequest } from 'fastify'
import type { AnalyticsWriter, IncomingEvent, JsonObject, NormalizedEvent } from './types.js'

const jsonObjectSchema = z.record(z.unknown())

const eventSchema = z.object({
  api_key: z.string().optional(),
  token: z.string().optional(),
  event: z.string().optional(),
  distinct_id: z.string().optional(),
  properties: jsonObjectSchema.optional().default({}),
  timestamp: z.string().optional()
}).passthrough()

const singlePayloadSchema = eventSchema

const batchPayloadSchema = z.object({
  api_key: z.string().optional(),
  token: z.string().optional(),
  batch: z.array(eventSchema).min(1),
  historical_migration: z.boolean().optional()
}).passthrough()

export type ParsedPayload = {
  apiKey: string
  events: IncomingEvent[]
}

export type NormalizedEventsResult = {
  events: NormalizedEvent[]
  dropped: number
}

export function parsePayload(body: unknown): ParsedPayload {
  const decodedBody = decodeBody(body)

  if (Array.isArray(decodedBody)) {
    const events = z.array(eventSchema).parse(decodedBody)
    const apiKey = events.find((event) => event.api_key ?? event.token)?.api_key ?? events.find((event) => event.api_key ?? event.token)?.token
    return {
      apiKey: requireApiKey(apiKey),
      events
    }
  }

  if (isRecord(decodedBody) && Array.isArray(decodedBody.batch)) {
    const parsed = batchPayloadSchema.parse(decodedBody)
    const apiKey = parsed.api_key ?? parsed.token
    return {
      apiKey: requireApiKey(apiKey),
      events: parsed.batch.map((event) => ({
        ...event,
        api_key: event.api_key ?? event.token ?? apiKey
      }))
    }
  }

  const parsed = singlePayloadSchema.parse(decodedBody)
  return {
    apiKey: requireApiKey(parsed.api_key ?? parsed.token),
    events: [parsed]
  }
}

export async function normalizeEvents(
  writer: AnalyticsWriter,
  apiKey: string,
  events: IncomingEvent[],
  request: FastifyRequest
): Promise<NormalizedEventsResult> {
  const now = new Date()
  const candidates: Array<{
    incoming: IncomingEvent
    eventName: string
    properties: JsonObject
    distinctId: string
    timestamp: Date
  }> = []
  const normalized: NormalizedEvent[] = []
  let dropped = 0

  for (const incoming of events) {
    const eventApiKey = incoming.api_key ?? incoming.token ?? apiKey
    if (eventApiKey !== apiKey) {
      throw new Error('Mixed api_key values in one batch are not supported')
    }

    const properties = incoming.properties ?? {}
    if (!incoming.event || !incoming.event.trim()) {
      dropped += 1
      continue
    }

    const distinctId = firstString(incoming.distinct_id, properties.distinct_id, properties.$distinct_id)
    if (!distinctId) {
      dropped += 1
      continue
    }

    const timestamp = parseTimestamp(incoming.timestamp) ?? now
    candidates.push({
      incoming,
      eventName: incoming.event,
      properties,
      distinctId,
      timestamp
    })
  }

  const distinctIds = new Set<string>()
  for (const candidate of candidates) {
    distinctIds.add(candidate.distinctId)
    const anonymousId = firstString(candidate.properties.$anon_distinct_id, candidate.properties.anon_distinct_id)
    if (anonymousId) {
      distinctIds.add(anonymousId)
    }
  }
  const resolvedPeople = await writer.resolvePersonIds([...distinctIds])
  const batchAliases = batchPersonAliases(candidates, resolvedPeople)

  for (const { incoming, eventName, properties, distinctId, timestamp } of candidates) {
    const personId = resolvePersonForEvent(resolvedPeople, batchAliases, incoming, distinctId, properties)

    normalized.push({
      eventId: randomUUID(),
      apiKey,
      event: eventName,
      distinctId,
      personId,
      sessionId: firstString(properties.$session_id, properties.session_id) ?? '',
      windowId: firstString(properties.$window_id, properties.window_id) ?? '',
      elementsChain: firstString(properties.$elements_chain, properties.elements_chain) ?? '',
      timestamp,
      receivedAt: now,
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? '',
      currentUrl: firstString(properties.$current_url, properties.current_url) ?? '',
      host: firstString(properties.$host, properties.host) ?? '',
      properties
    })
  }

  return {
    events: normalized,
    dropped
  }
}

export async function applyIdentitySideEffects(writer: AnalyticsWriter, event: NormalizedEvent): Promise<void> {
  await writer.upsertAlias({
    apiKey: event.apiKey,
    distinctId: event.distinctId,
    personId: event.personId
  })

  if (event.event === '$identify' || event.event === '$set') {
    const setProperties = objectProperty(event.properties, '$set')
    const setOnceProperties = objectProperty(event.properties, '$set_once')
    const anonymousId = firstString(event.properties.$anon_distinct_id, event.properties.anon_distinct_id)

    await writer.upsertPerson({
      apiKey: event.apiKey,
      distinctId: event.distinctId,
      personId: event.personId,
      properties: setProperties ?? {},
      setOnceProperties: setOnceProperties ?? {},
      isIdentified: event.event === '$identify'
    })
    if (event.event === '$identify' && anonymousId) {
      await writer.upsertAlias({
        apiKey: event.apiKey,
        distinctId: anonymousId,
        personId: event.personId
      })
    }
  }

  if (event.event === '$create_alias') {
    const alias = firstString(event.properties.alias)
    if (alias) {
      await writer.upsertAlias({
        apiKey: event.apiKey,
        distinctId: alias,
        personId: event.personId
      })
    }
  }
}

function decodeBody(body: unknown): unknown {
  if (typeof body !== 'string') {
    return body
  }

  const trimmed = body.trim()
  if (!trimmed) {
    return {}
  }

  const params = new URLSearchParams(trimmed)
  const encoded = params.get('data')
  if (encoded) {
    return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))
  }

  return JSON.parse(trimmed)
}

function resolvePersonForEvent(
  resolvedPeople: Map<string, string>,
  batchAliases: Map<string, string>,
  incoming: IncomingEvent,
  distinctId: string,
  properties: JsonObject
): string {
  const batchPersonId = batchAliases.get(distinctId)
  if (batchPersonId) {
    return batchPersonId
  }

  const anonymousId = firstString(properties.$anon_distinct_id, properties.anon_distinct_id)
  if (anonymousId) {
    const anonymousBatchPersonId = batchAliases.get(anonymousId)
    if (anonymousBatchPersonId) {
      return anonymousBatchPersonId
    }
  }

  if (incoming.event === '$identify') {
    return resolvedPeople.get(distinctId) ?? deterministicPersonId(distinctId)
  }
  const identified = resolvedPeople.get(distinctId)
  if (identified) {
    return identified
  }
  if (anonymousId) {
    return resolvedPeople.get(anonymousId) ?? deterministicPersonId(distinctId)
  }
  return deterministicPersonId(distinctId)
}

function batchPersonAliases(
  candidates: Array<{
    incoming: IncomingEvent
    distinctId: string
    properties: JsonObject
  }>,
  resolvedPeople: Map<string, string>
): Map<string, string> {
  const aliases = new Map<string, string>()

  for (const { incoming, distinctId, properties } of candidates) {
    if (incoming.event === '$identify') {
      const anonymousId = firstString(properties.$anon_distinct_id, properties.anon_distinct_id)
      const personId = resolvedPeople.get(distinctId)
        ?? (anonymousId ? resolvedPeople.get(anonymousId) : undefined)
        ?? deterministicPersonId(distinctId)

      aliases.set(distinctId, personId)
      if (anonymousId) {
        aliases.set(anonymousId, personId)
      }
    }

    if (incoming.event === '$create_alias') {
      const alias = firstString(properties.alias)
      if (!alias) {
        continue
      }
      const personId = resolvedPeople.get(distinctId)
        ?? resolvedPeople.get(alias)
        ?? deterministicPersonId(distinctId)

      aliases.set(distinctId, personId)
      aliases.set(alias, personId)
    }
  }

  return aliases
}

function deterministicPersonId(distinctId: string): string {
  const hash = createHash('sha1').update(distinctId).digest()
  const bytes = Buffer.from(hash.subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function parseTimestamp(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp: ${value}`)
  }
  return date
}

function requireApiKey(value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new Error('api_key is required')
  }
  return value
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return undefined
}

function objectProperty(properties: JsonObject, key: string): JsonObject | undefined {
  const value = properties[key]
  return isRecord(value) ? value : undefined
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
