---
title: Identifying Users
description: Anonymous IDs, identify, person properties, aliases, and reset.
---

# Identifying Users

Product analytics needs to connect anonymous pre-login behavior with known users after signup or login. The browser SDK starts with an anonymous distinct ID. When you know who the user is, call `identify` with a stable user ID.

For exact SDK signatures, see the [generated SDK reference](./reference/sdk/sdk/src/README.md). For backend identity payloads, see the [HTTP API reference](./reference/http-api.md).

## Distinct IDs and Person IDs

Every event has a `distinct_id`. In the browser, the SDK creates one automatically and stores it using the configured persistence layer. Backend events must provide a `distinct_id` directly.

The ingest service resolves each `distinct_id` to a `person_id` globally within the deployment:

- If the distinct ID already exists in `person_distinct_ids`, the existing `person_id` is used.
- If it does not exist, a deterministic `person_id` is derived from the distinct ID.
- Every accepted event writes or refreshes the event distinct ID in `person_distinct_ids`.
- `$identify` and `$create_alias` also link additional anonymous or alias IDs to the same `person_id`.

Use stable database IDs, account IDs, or UUIDs as identified user IDs. Avoid temporary IDs, emails that can change, or values such as `anonymous`, `guest`, `unknown`, `true`, `false`, or `null`.

## Browser Identify

Call `identify` after login or signup:

```ts
analytics.identify('user_123', {
  email: 'user@example.com',
  plan: 'pro'
}, {
  first_seen_source: 'pricing_page'
})

await analytics.flush()
```

This emits a `$identify` event. If the browser was previously anonymous, the event includes `$anon_distinct_id` so the ingest service can link the old anonymous ID and the new known ID to the same person.

## Backend Identify

You can identify users through the direct API by sending `$identify`:

```bash
curl -X POST http://127.0.0.1:8080/batch/ \
  -H 'content-type: application/json' \
  -d '{
    "api_key": "local_dev_key",
    "batch": [
      {
        "event": "$identify",
        "distinct_id": "user_123",
        "properties": {
          "$anon_distinct_id": "anonymous_device_abc",
          "$set": {
            "email": "user@example.com",
            "plan": "pro"
          },
          "$set_once": {
            "first_seen_source": "pricing_page"
          }
        }
      }
    ]
  }'
```

Backend services do not have automatic anonymous browser state. Use backend identify when a server process learns that two IDs should refer to the same person or when you need to update person properties from server-side facts.

## Person Properties

`$set` overwrites existing properties:

```ts
analytics.setPersonProperties({
  plan: 'enterprise',
  last_login_at: new Date().toISOString()
})
```

`$set_once` only writes a property if it does not already exist:

```ts
analytics.setPersonProperties({}, {
  first_seen_source: 'invite'
})
```

The ingest service stores merged person properties in `persons.properties` as a JSON string. Query the latest version with `FINAL`:

```sql
SELECT
    distinct_id,
    JSONExtractString(properties, 'email') AS email,
    JSONExtractString(properties, 'plan') AS plan,
    JSONExtractString(properties, 'first_seen_source') AS first_seen_source
FROM product_analytics.persons FINAL
WHERE distinct_id = 'user_123'
  AND is_deleted = 0;
```

## Alias

Use `alias` when you need to connect another ID to the same person:

```ts
analytics.alias('backend_user_123', 'frontend_user_123')
await analytics.flush()
```

The SDK emits `$create_alias` with `alias`. The ingest service writes both IDs into `person_distinct_ids` with the same `person_id`.

Direct API form:

```bash
curl -X POST http://127.0.0.1:8080/batch/ \
  -H 'content-type: application/json' \
  -d '{
    "api_key": "local_dev_key",
    "batch": [
      {
        "event": "$create_alias",
        "distinct_id": "frontend_user_123",
        "properties": {
          "alias": "backend_user_123"
        }
      }
    ]
  }'
```

## Reset on Logout

Call `reset()` when a user logs out. This creates a new anonymous distinct ID for future browser events on the same device:

```ts
analytics.reset()
```

Pass `true` to also reset the device ID:

```ts
analytics.reset(true)
```

## Query Identity Links

Find all known distinct IDs for a person:

```sql
SELECT
    person_id,
    groupArray(distinct_id) AS distinct_ids
FROM product_analytics.person_distinct_ids FINAL
WHERE is_deleted = 0
GROUP BY person_id
HAVING has(distinct_ids, 'user_123');
```

Join recent events to latest person properties:

```sql
WITH latest_people AS (
    SELECT
        id,
        properties
    FROM product_analytics.persons FINAL
    WHERE is_deleted = 0
)
SELECT
    e.timestamp,
    e.event,
    e.distinct_id,
    JSONExtractString(p.properties, 'email') AS email,
    JSONExtractString(e.properties, 'plan') AS event_plan
FROM product_analytics.events AS e
LEFT JOIN latest_people AS p ON p.id = e.person_id
WHERE e.timestamp >= now() - INTERVAL 7 DAY
ORDER BY e.timestamp DESC
LIMIT 100;
```

## Practical Rules

- Identify as soon as the user is known, usually after login/signup and on app boot when authenticated state is available.
- Use durable IDs from your application database.
- Do not call `identify` with placeholder values.
- Use `$set_once` for acquisition or first-touch facts.
- Use `$set` for mutable profile facts such as plan, role, or last login.
- Call `reset()` on logout, especially on shared devices.
