---
title: HTTP API Reference
description: Public ingest endpoints, payloads, responses, and error semantics.
---

# HTTP API Reference

The ingest service exposes a small public event API. It accepts browser SDK batches, backend service events, and compatibility-style capture calls. There is no project or tenant ID in this service; each deployment writes to one ClickHouse database and validates requests with `PUBLIC_API_KEYS`.

## Endpoints

All event ingestion endpoints accept `POST` with JSON bodies:

| Endpoint | Purpose |
| --- | --- |
| `/batch/` and `/batch` | Batch events from the browser SDK or backend services. |
| `/capture/` and `/capture` | Single event capture endpoint. |
| `/i/v0/e/` and `/i/v0/e` | Compatibility-style single event endpoint. |
| `/e/` and `/e` | Short single event endpoint. |
| `/health` | `GET` readiness and liveness check. |

## Authentication

Send `api_key` or `token` in the request body. The value must be listed in the service's `PUBLIC_API_KEYS` environment variable.

```json
{
  "api_key": "local_dev_key",
  "event": "backend_job_completed",
  "distinct_id": "user_123"
}
```

Requests with unknown keys return `401`.

## Single Event Payload

```json
{
  "api_key": "local_dev_key",
  "event": "backend_job_completed",
  "distinct_id": "user_123",
  "timestamp": "2026-05-02T12:00:00.000Z",
  "properties": {
    "job_id": "job_456",
    "duration_ms": 481
  }
}
```

Fields:

| Field | Required | Notes |
| --- | --- | --- |
| `api_key` or `token` | Yes | Publishable key accepted by the service. |
| `event` | Yes | Stable event name. Empty names are dropped. |
| `distinct_id` | Yes | User, anonymous, device, or backend actor ID. |
| `timestamp` | No | ISO timestamp. Defaults to ingest time. |
| `properties` | No | JSON object. URL/session/person fields are promoted when present. |

## Batch Payload

```json
{
  "api_key": "local_dev_key",
  "batch": [
    {
      "event": "$pageview",
      "distinct_id": "anon_123",
      "properties": {
        "$current_url": "https://example.com/",
        "$session_id": "session_123"
      }
    }
  ]
}
```

All events in a batch must resolve to the same API key. Mixed keys return `400`. Batches larger than `MAX_EVENTS_PER_BATCH` return `413`.

The service also accepts an array of event objects as the request body when each event carries `api_key` or `token`.

## Form-Encoded Payloads

For clients that cannot send JSON directly, send `application/x-www-form-urlencoded` with a `data` field containing a base64-encoded JSON payload:

```bash
payload='{"api_key":"local_dev_key","event":"backend_job_completed","distinct_id":"user_123"}'
curl -X POST http://127.0.0.1:8080/capture/ \
  -H 'content-type: application/x-www-form-urlencoded' \
  --data-urlencode "data=$(printf '%s' "$payload" | base64)"
```

The decoded JSON can be a single-event payload, a batch payload, or an array of event objects.

## Identity Payloads

`$identify` links an anonymous ID to a known user and updates the `persons` table:

```json
{
  "api_key": "local_dev_key",
  "event": "$identify",
  "distinct_id": "user_123",
  "properties": {
    "$anon_distinct_id": "anon_123",
    "$set": {
      "email": "user@example.com"
    },
    "$set_once": {
      "first_seen_source": "landing_page"
    }
  }
}
```

`$set` updates person properties without creating an identify event. `$create_alias` links another distinct ID with the current person.

## Compression

The service accepts compressed request bodies with `content-encoding: gzip`, `content-encoding: deflate`, or `content-encoding: br`. It also accepts the query parameter `compression=gzip-js` for clients that cannot set request headers.

Compressed payloads are still limited by `MAX_BATCH_BYTES` after inflation. Oversized requests return `413`.

## CORS and Origins

Browser requests must use an `Origin` listed in `ALLOWED_ORIGINS`. Backend requests usually omit `Origin`; they are accepted when `ALLOW_SERVER_EVENTS_WITHOUT_ORIGIN=true`.

## Responses

Successful ingestion returns:

```json
{
  "status": "ok",
  "ingested": 1,
  "dropped": 0
}
```

`dropped` counts events missing required event or distinct ID fields. Dropped events do not fail the whole batch.

Common errors:

| Status | Meaning |
| --- | --- |
| `400` | Invalid payload, invalid timestamp, missing API key, or mixed batch keys. |
| `401` | Unknown API key. |
| `403` | Origin is not allowed. |
| `413` | Request body or event count exceeds configured limits. |
| `500` | Unexpected server or ClickHouse write error. |
