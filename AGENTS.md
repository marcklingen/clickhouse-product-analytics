# Repository Instructions

- Use subagents aggressively to offload tasks and research.
- When changing the public ingest HTTP API, update the committed OpenAPI spec and the Fumadocs API reference in the same change. This includes route aliases, request payloads, response payloads, authentication, accepted encodings, compression behavior, CORS/origin behavior, and documented error semantics.
- The OpenAPI spec must mirror the implemented API behavior exactly, including permissive request parsing, dropped-event semantics, route aliases, optional fields that are required only for successful ingestion, passthrough properties, accepted content types, compression options, and concrete error status behavior. Do not make the spec stricter or cleaner than the service actually is unless the service implementation changes in the same patch.
