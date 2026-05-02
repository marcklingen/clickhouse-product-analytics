[**SDK and React Reference**](../../../README.md)

***

[SDK and React Reference](../../../README.md) / [react/src](../README.md) / AnalyticsProviderProps

# Type Alias: AnalyticsProviderProps

> **AnalyticsProviderProps** = `WithChildren`\<\{ `apiKey?`: `never`; `client`: [`AnalyticsClient`](AnalyticsClient.md); `options?`: `never`; \} \| \{ `apiKey`: `string`; `client?`: `never`; `options`: `Omit`\<`InitOptions`, `"apiKey"` \| `"token"`\>; \}\>

Defined in: react/src/index.tsx:32

Props for `AnalyticsProvider`. Pass either a managed `apiKey`/`options` pair or an explicit client.
