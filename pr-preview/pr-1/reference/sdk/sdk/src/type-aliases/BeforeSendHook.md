[**SDK and React Reference**](../../../README.md)

***

[SDK and React Reference](../../../README.md) / [sdk/src](../README.md) / BeforeSendHook

# Type Alias: BeforeSendHook

> **BeforeSendHook** = (`event`) => `BeforeSendEvent` \| `false` \| `null` \| `undefined`

Defined in: [sdk/src/types.ts:49](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/sdk/src/types.ts#L49)

Hook that can mutate an event before enqueueing it, or return a falsy value to drop it.

## Parameters

### event

`BeforeSendEvent`

## Returns

`BeforeSendEvent` \| `false` \| `null` \| `undefined`
