import { createClient, type ClickHouseClient } from '@clickhouse/client'
import type { ServiceConfig } from './config.js'
import type { AliasUpdate, AnalyticsWriter, JsonObject, NormalizedEvent, PersonUpdate } from './types.js'

export class ClickHouseAnalyticsWriter implements AnalyticsWriter {
  private readonly client: ClickHouseClient
  private readonly database: string
  private lastVersion = Date.now() * 1000

  constructor(config: ServiceConfig) {
    this.database = config.clickhouse.database
    this.client = createClient({
      url: config.clickhouse.url,
      username: config.clickhouse.username,
      password: config.clickhouse.password,
      database: this.database,
      clickhouse_settings: {
        date_time_input_format: 'best_effort'
      }
    })
  }

  async resolvePersonId(distinctId: string): Promise<string | undefined> {
    return (await this.resolvePersonIds([distinctId])).get(distinctId)
  }

  async resolvePersonIds(distinctIds: string[]): Promise<Map<string, string>> {
    if (distinctIds.length === 0) {
      return new Map()
    }
    const result = await this.client.query({
      query: `
        SELECT distinct_id, person_id
        FROM ${identifier(this.database)}.person_distinct_ids FINAL
        WHERE distinct_id IN {distinct_ids:Array(String)}
          AND is_deleted = 0
      `,
      query_params: {
        distinct_ids: distinctIds
      },
      format: 'JSONEachRow'
    })
    const rows = await result.json<{ distinct_id: string; person_id: string }>()
    return new Map(rows.map((row) => [row.distinct_id, row.person_id]))
  }

  async writeEvents(events: NormalizedEvent[]): Promise<void> {
    if (events.length === 0) {
      return
    }
    await this.client.insert({
      table: `${identifier(this.database)}.events`,
      values: events.map((event) => ({
        uuid: event.eventId,
        api_key: event.apiKey,
        event: event.event,
        distinct_id: event.distinctId,
        person_id: event.personId,
        session_id: event.sessionId,
        window_id: event.windowId,
        elements_chain: event.elementsChain,
        timestamp: clickhouseDate(event.timestamp),
        inserted_at: clickhouseDate(event.receivedAt),
        ip: event.ip,
        user_agent: event.userAgent,
        current_url: event.currentUrl,
        host: event.host,
        properties: JSON.stringify(event.properties)
      })),
      format: 'JSONEachRow'
    })
  }

  async upsertPerson(update: PersonUpdate): Promise<void> {
    const now = clickhouseDate(new Date())
    const version = this.nextVersion()
    const existing = await this.fetchPerson(update.personId)
    const properties = mergePersonProperties(existing?.properties ?? {}, update.setOnceProperties, update.properties)
    await this.client.insert({
      table: `${identifier(this.database)}.persons`,
      values: [{
        distinct_id: update.distinctId,
        id: update.personId,
        properties: JSON.stringify(properties),
        created_at: existing?.createdAt ?? now,
        updated_at: now,
        last_seen_at: now,
        is_identified: update.isIdentified ? 1 : 0,
        is_deleted: 0,
        version
      }],
      format: 'JSONEachRow'
    })
  }

  async upsertAlias(update: AliasUpdate): Promise<void> {
    const version = this.nextVersion()
    await this.client.insert({
      table: `${identifier(this.database)}.person_distinct_ids`,
      values: [{
        distinct_id: update.distinctId,
        person_id: update.personId,
        created_at: clickhouseDate(new Date()),
        is_deleted: 0,
        version
      }],
      format: 'JSONEachRow'
    })
  }

  private nextVersion(): number {
    const candidate = Date.now() * 1000
    this.lastVersion = Math.max(candidate, this.lastVersion + 1)
    return this.lastVersion
  }

  async close(): Promise<void> {
    await this.client.close()
  }

  private async fetchPerson(personId: string): Promise<{ properties: JsonObject; createdAt: string } | undefined> {
    const result = await this.client.query({
      query: `
        SELECT properties, created_at
        FROM ${identifier(this.database)}.persons FINAL
        WHERE id = {person_id:UUID}
          AND is_deleted = 0
        LIMIT 1
      `,
      query_params: {
        person_id: personId
      },
      format: 'JSONEachRow'
    })
    const rows = await result.json<{ properties: string; created_at: string }>()
    const row = rows[0]
    if (!row) {
      return undefined
    }
    return {
      properties: parseProperties(row.properties),
      createdAt: row.created_at
    }
  }
}

function clickhouseDate(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '')
}

function identifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid ClickHouse identifier: ${value}`)
  }
  return value
}

function parseProperties(value: string): JsonObject {
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as JsonObject : {}
  } catch {
    return {}
  }
}

function mergePersonProperties(existing: JsonObject, setOnce: JsonObject, set: JsonObject): JsonObject {
  const merged = { ...existing }
  for (const [key, value] of Object.entries(setOnce)) {
    if (merged[key] === undefined) {
      merged[key] = value
    }
  }
  return {
    ...merged,
    ...set
  }
}
