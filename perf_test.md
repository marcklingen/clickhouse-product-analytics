# Local Ingest Performance Test

This file records the local performance check requested in `TODO.md`.

## Benchmark

Command:

```bash
npm run benchmark:ingest
```

The benchmark builds the ingest service, starts the maintained Fastify service and a native-HTTP candidate, then sends 300 batch requests with 100 events per batch at concurrency 30. Both implementations reuse the same parser, normalization, identity side effects, and in-memory writer. The benchmark intentionally avoids ClickHouse network I/O so it isolates HTTP framework and request handling overhead.

## Result

After changing the default service log level from per-request `info` logging to `warn`, the local result was:

| Implementation | Duration | Requests/sec | Events/sec |
| --- | ---: | ---: | ---: |
| Fastify service | 222.03 ms | 1,351.20 | 135,119.59 |
| Native HTTP candidate | 165.18 ms | 1,816.23 | 181,623.30 |

The native-HTTP candidate was about 34% faster in this synthetic in-memory benchmark.

## Decision

The production service remains on Fastify for now. The native candidate did not include the full production surface area that Fastify already covers and tests well: CORS registration, compressed body handling, request size enforcement through the framework, structured error handling, lifecycle hooks, and plugin compatibility. The benchmark still produced one concrete improvement that was applied to the kept implementation: high-volume ingest should not log every successful request by default, so `LOG_LEVEL` now defaults to `warn`.

If ingest HTTP overhead becomes a measured bottleneck with real ClickHouse writes, the next step should be to promote the native candidate into a fully tested alternative server and re-run the E2E suite against both implementations before switching the default.
