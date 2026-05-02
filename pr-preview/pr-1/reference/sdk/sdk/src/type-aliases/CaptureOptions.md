[**SDK and React Reference**](../../../README.md)

***

[SDK and React Reference](../../../README.md) / [sdk/src](../README.md) / CaptureOptions

# Type Alias: CaptureOptions

> **CaptureOptions** = `object`

Defined in: [sdk/src/types.ts:5](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/sdk/src/types.ts#L5)

Per-event options accepted by [ClickHouseProductAnalytics.capture](../classes/ClickHouseProductAnalytics.md#capture).

## Properties

### $set?

> `optional` **$set?**: [`CaptureProperties`](CaptureProperties.md)

Defined in: [sdk/src/types.ts:15](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/sdk/src/types.ts#L15)

Person properties to overwrite when sending identity events.

***

### $set\_once?

> `optional` **$set\_once?**: [`CaptureProperties`](CaptureProperties.md)

Defined in: [sdk/src/types.ts:17](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/sdk/src/types.ts#L17)

Person properties to set only if the target property is currently absent.

***

### distinct\_id?

> `optional` **distinct\_id?**: `string`

Defined in: [sdk/src/types.ts:13](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/sdk/src/types.ts#L13)

Send the event under a distinct ID other than the current client ID.

***

### send\_instantly?

> `optional` **send\_instantly?**: `boolean`

Defined in: [sdk/src/types.ts:9](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/sdk/src/types.ts#L9)

Flush the queue immediately after enqueueing this event.

***

### timestamp?

> `optional` **timestamp?**: `Date`

Defined in: [sdk/src/types.ts:7](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/sdk/src/types.ts#L7)

Override the event timestamp. Defaults to the current time.

***

### transport?

> `optional` **transport?**: `"fetch"` \| `"sendBeacon"`

Defined in: [sdk/src/types.ts:11](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/sdk/src/types.ts#L11)

Force a specific transport for this event's flush.
