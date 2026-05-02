[**SDK and React Reference**](../../../README.md)

***

[SDK and React Reference](../../../README.md) / [react/src](../README.md) / AnalyticsProviderProps

# Type Alias: AnalyticsProviderProps

> **AnalyticsProviderProps** = `WithChildren`\<\{ `apiKey?`: `never`; `client`: [`AnalyticsClient`](AnalyticsClient.md); `options?`: `never`; \} \| \{ `apiKey?`: `string`; `client?`: `never`; `options`: `Omit`\<`InitOptions`, `"apiKey"`\>; \}\>

Defined in: [react/src/index.tsx:32](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/react/src/index.tsx#L32)

Props for `AnalyticsProvider`. Pass either managed options with an optional API key or an explicit client.
