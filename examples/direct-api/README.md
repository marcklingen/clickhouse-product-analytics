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

The event shape is documented in `docs/reference/http-api.md`.
