[**SDK and React Reference**](../../../README.md)

***

[SDK and React Reference](../../../README.md) / [sdk/src](../README.md) / ClickHouseProductAnalytics

# Class: ClickHouseProductAnalytics

Defined in: sdk/src/index.ts:70

Browser analytics client for capturing product events into the ingest service.

## Constructors

### Constructor

> **new ClickHouseProductAnalytics**(): `ClickHouseProductAnalytics`

#### Returns

`ClickHouseProductAnalytics`

## Methods

### alias()

> **alias**(`alias`, `original?`): [`QueuedEvent`](../type-aliases/QueuedEvent.md) \| `undefined`

Defined in: sdk/src/index.ts:208

Link another distinct ID to the current or supplied original distinct ID.

#### Parameters

##### alias

`string`

##### original?

`string` = `...`

#### Returns

[`QueuedEvent`](../type-aliases/QueuedEvent.md) \| `undefined`

***

### capture()

> **capture**(`eventName`, `properties?`, `options?`): [`QueuedEvent`](../type-aliases/QueuedEvent.md) \| `undefined`

Defined in: sdk/src/index.ts:115

Capture a named event with optional properties.

#### Parameters

##### eventName

`string`

##### properties?

[`CaptureProperties`](../type-aliases/CaptureProperties.md) \| `null`

##### options?

[`CaptureOptions`](../type-aliases/CaptureOptions.md) = `{}`

#### Returns

[`QueuedEvent`](../type-aliases/QueuedEvent.md) \| `undefined`

***

### flush()

> **flush**(`transport?`): `Promise`\<`void`\>

Defined in: sdk/src/index.ts:305

Flush queued events using fetch or, when requested, sendBeacon.

#### Parameters

##### transport?

`"fetch"` \| `"sendBeacon"`

#### Returns

`Promise`\<`void`\>

***

### get\_distinct\_id()

> **get\_distinct\_id**(): `string`

Defined in: sdk/src/index.ts:261

Return the current distinct ID.

#### Returns

`string`

***

### get\_property()

> **get\_property**(`property`): `unknown`

Defined in: sdk/src/index.ts:274

Return a registered property value or the current distinct ID.

#### Parameters

##### property

`string`

#### Returns

`unknown`

***

### get\_session\_id()

> **get\_session\_id**(): `string`

Defined in: sdk/src/index.ts:267

Return the current session ID, rotating the session first if it has expired.

#### Returns

`string`

***

### has\_opted\_out\_capturing()

> **has\_opted\_out\_capturing**(): `boolean`

Defined in: sdk/src/index.ts:294

Return whether this client is currently opted out.

#### Returns

`boolean`

***

### identify()

> **identify**(`newDistinctId?`, `userPropertiesToSet?`, `userPropertiesToSetOnce?`): `void`

Defined in: sdk/src/index.ts:164

Associate future events with a known user and optionally set person properties.

#### Parameters

##### newDistinctId?

`string`

##### userPropertiesToSet?

[`CaptureProperties`](../type-aliases/CaptureProperties.md) = `{}`

##### userPropertiesToSetOnce?

[`CaptureProperties`](../type-aliases/CaptureProperties.md) = `{}`

#### Returns

`void`

***

### init()

#### Call Signature

> **init**(`token`, `config?`): `this`

Defined in: sdk/src/index.ts:79

Initialize the client with a publishable API key and browser SDK options.

##### Parameters

###### token

`string`

###### config?

`Omit`\<[`InitOptions`](../type-aliases/InitOptions.md), `"apiKey"` \| `"token"`\>

##### Returns

`this`

#### Call Signature

> **init**(`config`): `this`

Defined in: sdk/src/index.ts:81

Initialize the client with a complete options object.

##### Parameters

###### config

[`InitOptions`](../type-aliases/InitOptions.md)

##### Returns

`this`

***

### is\_capturing()

> **is\_capturing**(): `boolean`

Defined in: sdk/src/index.ts:300

Return whether this client will enqueue new events.

#### Returns

`boolean`

***

### opt\_in\_capturing()

> **opt\_in\_capturing**(): `void`

Defined in: sdk/src/index.ts:287

Resume capturing events after an opt-out.

#### Returns

`void`

***

### opt\_out\_capturing()

> **opt\_out\_capturing**(): `void`

Defined in: sdk/src/index.ts:280

Stop capturing events until `opt_in_capturing` is called.

#### Returns

`void`

***

### register()

> **register**(`properties`): `void`

Defined in: sdk/src/index.ts:233

Register properties that are attached to all future events.

#### Parameters

##### properties

[`CaptureProperties`](../type-aliases/CaptureProperties.md)

#### Returns

`void`

***

### register\_once()

> **register\_once**(`properties`, `defaultValue?`): `void`

Defined in: sdk/src/index.ts:243

Register properties only when their current value is absent or equal to `defaultValue`.

#### Parameters

##### properties

[`CaptureProperties`](../type-aliases/CaptureProperties.md)

##### defaultValue?

`unknown` = `'None'`

#### Returns

`void`

***

### reset()

> **reset**(`resetDeviceId?`): `void`

Defined in: sdk/src/index.ts:213

Reset local identity and session state, optionally generating a new device ID.

#### Parameters

##### resetDeviceId?

`boolean` = `false`

#### Returns

`void`

***

### setPersonProperties()

> **setPersonProperties**(`userPropertiesToSet?`, `userPropertiesToSetOnce?`): `void`

Defined in: sdk/src/index.ts:197

Set or set-once person properties for the current distinct ID.

#### Parameters

##### userPropertiesToSet?

[`CaptureProperties`](../type-aliases/CaptureProperties.md) = `{}`

##### userPropertiesToSetOnce?

[`CaptureProperties`](../type-aliases/CaptureProperties.md) = `{}`

#### Returns

`void`

***

### shutdown()

> **shutdown**(): `void`

Defined in: sdk/src/index.ts:311

Remove lifecycle listeners and stop queue timers.

#### Returns

`void`

***

### unregister()

> **unregister**(`property`): `void`

Defined in: sdk/src/index.ts:254

Remove a registered super property from future events.

#### Parameters

##### property

`string`

#### Returns

`void`
