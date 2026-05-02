[**SDK and React Reference**](../../../README.md)

***

[SDK and React Reference](../../../README.md) / [react/src](../README.md) / AnalyticsCaptureOnViewedProps

# Type Alias: AnalyticsCaptureOnViewedProps

> **AnalyticsCaptureOnViewedProps** = `HTMLAttributes`\<`HTMLDivElement`\> & `object`

Defined in: [react/src/index.tsx:123](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/react/src/index.tsx#L123)

Props for `AnalyticsCaptureOnViewed`, a viewport-impression helper.

## Type Declaration

### eventName?

> `optional` **eventName?**: `string`

Event name to capture when viewed. Defaults to `$element_viewed`.

### name?

> `optional` **name?**: `string`

Stable name for the viewed element. Sent as `element_name`.

### observerOptions?

> `optional` **observerOptions?**: `IntersectionObserverInit`

IntersectionObserver options used to decide when the element is viewed.

### properties?

> `optional` **properties?**: `Record`\<`string`, `unknown`\>

Additional event properties attached to each impression event.

### trackAllChildren?

> `optional` **trackAllChildren?**: `boolean`

Track each child separately instead of the wrapper as one impression.

### trackingKey?

> `optional` **trackingKey?**: `string`

Explicit key used to reset one-shot tracking when props change.
