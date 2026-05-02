[**SDK and React Reference**](../../../README.md)

***

[SDK and React Reference](../../../README.md) / [sdk/src](../README.md) / Transport

# Type Alias: Transport

> **Transport** = (`url`, `payload`, `options`) => `Promise`\<`void`\>

Defined in: [sdk/src/types.ts:36](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/sdk/src/types.ts#L36)

Custom transport hook for applications that need to override fetch/beacon delivery.

## Parameters

### url

`string`

### payload

[`TransportPayload`](TransportPayload.md)

### options

#### compression?

`boolean`

#### timeoutMs

`number`

#### transport?

`"fetch"` \| `"sendBeacon"`

## Returns

`Promise`\<`void`\>
