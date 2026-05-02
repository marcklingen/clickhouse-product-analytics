# Direct API Example

This example sends one backend-style event to the ingest service as a one-item `/batch/` payload.

## Run

Start the local stack:

```bash
docker compose up -d --build
```

Send the event:

```bash
node examples/direct-api/capture.mjs
```

Optional environment variables:

| Variable | Default |
| --- | --- |
| `CPA_SERVICE_URL` | `http://127.0.0.1:8080` |
| `CPA_API_KEY` | `local_dev_key` |

The event shape is documented in the Fumadocs API reference at `content/docs/reference/api.mdx` and the committed OpenAPI spec at `openapi/clickhouse-product-analytics.openapi.yaml`.
