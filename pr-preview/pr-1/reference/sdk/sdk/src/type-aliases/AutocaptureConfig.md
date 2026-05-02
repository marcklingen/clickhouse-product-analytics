[**SDK and React Reference**](../../../README.md)

***

[SDK and React Reference](../../../README.md) / [sdk/src](../README.md) / AutocaptureConfig

# Type Alias: AutocaptureConfig

> **AutocaptureConfig** = `object`

Defined in: [sdk/src/types.ts:52](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/sdk/src/types.ts#L52)

Privacy-oriented autocapture settings. Autocapture is disabled unless enabled explicitly.

## Properties

### captureText?

> `optional` **captureText?**: `boolean`

Defined in: [sdk/src/types.ts:54](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/sdk/src/types.ts#L54)

Include safe text snippets for allowed elements.

***

### css\_selector\_allowlist?

> `optional` **css\_selector\_allowlist?**: `string`[]

Defined in: [sdk/src/types.ts:58](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/sdk/src/types.ts#L58)

CSS selectors allowed for autocapture.

***

### dom\_event\_allowlist?

> `optional` **dom\_event\_allowlist?**: (`"click"` \| `"change"` \| `"submit"`)[]

Defined in: [sdk/src/types.ts:64](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/sdk/src/types.ts#L64)

DOM event names to listen for. Defaults to click/change/submit.

***

### element\_allowlist?

> `optional` **element\_allowlist?**: `string`[]

Defined in: [sdk/src/types.ts:56](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/sdk/src/types.ts#L56)

Element tag names allowed for autocapture, for example `button` or `a`.

***

### url\_allowlist?

> `optional` **url\_allowlist?**: (`string` \| `RegExp`)[]

Defined in: [sdk/src/types.ts:60](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/sdk/src/types.ts#L60)

URL patterns where autocapture is allowed.

***

### url\_ignorelist?

> `optional` **url\_ignorelist?**: (`string` \| `RegExp`)[]

Defined in: [sdk/src/types.ts:62](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/sdk/src/types.ts#L62)

URL patterns where autocapture is blocked.
