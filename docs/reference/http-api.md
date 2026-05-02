---
title: HTTP API Reference
description: Public ingest endpoints, payloads, responses, and error semantics.
---

# HTTP API Reference

The ingest service exposes one public event API. There is no project or tenant ID in this service; each deployment writes to one ClickHouse database. Browser requests are validated by `Origin`, while backend or no-origin requests use `api_key` credentials from `PUBLIC_API_KEYS`.

## Endpoints

Event ingestion accepts `POST` with JSON bodies at one canonical path:

| Endpoint | Purpose |
| --- | --- |
| `/batch/` | Batch events from the browser SDK or backend services. Send a single event as a one-item batch. |
| `/health` | `GET` readiness and liveness check. |

## Authentication

Browser requests from an allowed `Origin` can omit `api_key`. If a browser request includes `api_key`, the value must be listed in `PUBLIC_API_KEYS`; unknown provided keys return `401`.

Backend requests commonly omit `Origin`. Those requests require a valid `api_key`. `PUBLIC_API_KEYS` accepts a comma-separated list so operators can keep old and new backend keys active during rotation. To disable no-origin backend ingest, leave `PUBLIC_API_KEYS` empty.

```json
{
  "api_key": "local_dev_key",
  "batch": [
    {
      "event": "backend_job_completed",
      "distinct_id": "user_123"
    }
  ]
}
```

Requests from disallowed origins return `403`. No-origin requests with missing or unknown keys return `401`.

## Payload

```json
{
  "api_key": "local_dev_key",
  "batch": [
    {
      "event": "backend_job_completed",
      "distinct_id": "user_123",
      "timestamp": "2026-05-02T12:00:00.000Z",
      "properties": {
        "job_id": "job_456",
        "duration_ms": 481
      }
    }
  ]
}
```

Top-level fields:

| Field | Required | Notes |
| --- | --- | --- |
| `api_key` | Browser: no. No-origin backend: yes. | Ingest credential accepted by the service. It does not scope identity or create tenants. |
| `batch` | Yes | Non-empty array of event objects. |

Event fields:

| Field | Required | Notes |
| --- | --- | --- |
| `event` | Yes | Stable event name. Empty names are dropped. |
| `distinct_id` | Yes | User, anonymous, device, or backend actor ID. |
| `timestamp` | No | ISO timestamp. Defaults to ingest time. |
| `properties` | No | JSON object. URL/session/person fields are promoted when present, and arbitrary property keys are stored in ClickHouse. |

`event` and `distinct_id` are required for successful ingestion of an individual event. Events missing either field are dropped and counted in the response without failing the whole request. Top-level and event-level fields outside this contract are accepted but ignored unless they are inside `properties`.

If a batch includes keys in more than one place, all provided `api_key` values must match. Mixed keys return `400`. Batches larger than `MAX_EVENTS_PER_BATCH` return `413`.

## Identity Payloads

`$identify` links an anonymous ID to a known user and updates the `persons` table:

```json
{
  "api_key": "local_dev_key",
  "batch": [
    {
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
  ]
}
```

`$set` updates person properties without creating an identify event. `$create_alias` links another distinct ID with the current person.

## Compression

The service accepts gzip-compressed JSON request bodies with `content-encoding: gzip`.

Compressed payloads are still limited by `MAX_BATCH_BYTES` after inflation. Oversized requests return `413`.

## CORS and Origins

Browser requests must use an `Origin` listed in `ALLOWED_ORIGINS`. Backend requests usually omit `Origin`; they are accepted when the payload includes one of the configured API keys.

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
| `400` | Invalid payload, invalid timestamp, or mixed batch keys. |
| `401` | Missing key on no-origin backend requests, unknown provided key, or invalid provided browser key. |
| `403` | Origin is not allowed. |
| `413` | Request body or event count exceeds configured limits. |
| `415` | Unsupported content type, unsupported content encoding, or unsupported compression query parameter. |
| `500` | Unexpected server or ClickHouse write error. |
