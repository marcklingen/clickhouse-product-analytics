export type JsonObject = Record<string, unknown>

export type IncomingEvent = {
  api_key?: string
  token?: string
  event?: string
  distinct_id?: string
  properties?: JsonObject
  timestamp?: string
}

export type NormalizedEvent = {
  eventId: string
  apiKey: string
  event: string
  distinctId: string
  personId: string
  sessionId: string
  windowId: string
  elementsChain: string
  timestamp: Date
  receivedAt: Date
  ip: string
  userAgent: string
  currentUrl: string
  host: string
  properties: JsonObject
}

export type PersonUpdate = {
  apiKey: string
  distinctId: string
  personId: string
  properties: JsonObject
  setOnceProperties: JsonObject
  isIdentified: boolean
}

export type AliasUpdate = {
  apiKey: string
  distinctId: string
  personId: string
}

export type AnalyticsWriter = {
  resolvePersonId(distinctId: string): Promise<string | undefined>
  resolvePersonIds(distinctIds: string[]): Promise<Map<string, string>>
  writeEvents(events: NormalizedEvent[]): Promise<void>
  upsertPerson(update: PersonUpdate): Promise<void>
  upsertAlias(update: AliasUpdate): Promise<void>
  close(): Promise<void>
}
