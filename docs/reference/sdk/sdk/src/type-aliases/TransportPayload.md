[**SDK and React Reference**](../../../README.md)

***

[SDK and React Reference](../../../README.md) / [sdk/src](../README.md) / TransportPayload

# Type Alias: TransportPayload

> **TransportPayload** = `object`

Defined in: [sdk/src/types.ts:29](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/sdk/src/types.ts#L29)

Batch payload sent to the public ingest API.

## Properties

### api\_key?

> `optional` **api\_key?**: `string`

Defined in: [sdk/src/types.ts:31](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/sdk/src/types.ts#L31)

Optional ingest API key. Allowed-origin browser payloads can omit it.

***

### batch

> **batch**: [`QueuedEvent`](QueuedEvent.md)[]

Defined in: [sdk/src/types.ts:32](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/sdk/src/types.ts#L32)
