import type { AliasUpdate, AnalyticsWriter, NormalizedEvent, PersonUpdate } from './types.js'

export class MemoryAnalyticsWriter implements AnalyticsWriter {
  readonly events: NormalizedEvent[] = []
  readonly persons = new Map<string, PersonUpdate>()
  readonly aliases = new Map<string, string>()

  async resolvePersonId(distinctId: string): Promise<string | undefined> {
    return this.aliases.get(distinctId)
  }

  async resolvePersonIds(distinctIds: string[]): Promise<Map<string, string>> {
    const resolved = new Map<string, string>()
    for (const distinctId of distinctIds) {
      const personId = this.aliases.get(distinctId)
      if (personId) {
        resolved.set(distinctId, personId)
      }
    }
    return resolved
  }

  async writeEvents(events: NormalizedEvent[]): Promise<void> {
    this.events.push(...events)
  }

  async upsertPerson(update: PersonUpdate): Promise<void> {
    const previous = this.persons.get(update.distinctId)
    const nextProperties = {
      ...(previous?.properties ?? {})
    }
    for (const [key, value] of Object.entries(update.setOnceProperties)) {
      if (nextProperties[key] === undefined) {
        nextProperties[key] = value
      }
    }
    this.persons.set(update.distinctId, {
      ...update,
      properties: {
        ...nextProperties,
        ...update.properties
      }
    })
  }

  async upsertAlias(update: AliasUpdate): Promise<void> {
    this.aliases.set(update.distinctId, update.personId)
  }

  async close(): Promise<void> {
    return
  }
}
