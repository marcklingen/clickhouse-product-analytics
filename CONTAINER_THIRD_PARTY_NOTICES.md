# Container Third-Party Notices

This file is a distribution inventory for the ingest-service container image.
It covers the production npm dependency graph used by
`@clickhouse-product-analytics/ingest-service` after `npm prune --omit=dev`.

The container also includes the project `LICENSE`, `ATTRIBUTION.md`, and
`THIRD_PARTY_NOTICES.md` files. Individual npm package license files remain
inside `/app/node_modules`. The Node.js Alpine base image and Alpine packages
carry their own upstream license notices in the base image.

Generated from:

```bash
npm ls --omit=dev --all --json --workspace @clickhouse-product-analytics/ingest-service
```

## Internal Runtime Packages

| Package | Version | License |
| --- | --- | --- |
| `@clickhouse-product-analytics/ingest-service` | 0.1.0 | Apache-2.0 |
| `@clickhouse-product-analytics/sdk` | 0.1.0 | Apache-2.0 |

## External Runtime NPM Dependencies

| Package | Version | License |
| --- | --- | --- |
| `@clickhouse/client` | 1.18.3 | Apache-2.0 |
| `@clickhouse/client-common` | 1.18.3 | Apache-2.0 |
| `@fastify/ajv-compiler` | 4.0.5 | MIT |
| `@fastify/cors` | 11.2.0 | MIT |
| `@fastify/error` | 4.2.0 | MIT |
| `@fastify/fast-json-stringify-compiler` | 5.0.3 | MIT |
| `@fastify/forwarded` | 3.0.1 | MIT |
| `@fastify/merge-json-schemas` | 0.2.1 | MIT |
| `@fastify/proxy-addr` | 5.1.0 | MIT |
| `@pinojs/redact` | 0.4.0 | MIT |
| `abstract-logging` | 2.0.1 | MIT |
| `ajv` | 8.20.0 | MIT |
| `ajv-formats` | 3.0.1 | MIT |
| `atomic-sleep` | 1.0.0 | MIT |
| `avvio` | 9.2.0 | MIT |
| `cookie` | 1.1.1 | MIT |
| `dequal` | 2.0.3 | MIT |
| `fast-decode-uri-component` | 1.0.1 | MIT |
| `fast-deep-equal` | 3.1.3 | MIT |
| `fast-json-stringify` | 6.3.0 | MIT |
| `fast-querystring` | 1.1.2 | MIT |
| `fast-uri` | 3.1.0 | BSD-3-Clause |
| `fastify` | 5.8.5 | MIT |
| `fastify-plugin` | 5.1.0 | MIT |
| `fastq` | 1.20.1 | ISC |
| `find-my-way` | 9.5.0 | MIT |
| `ipaddr.js` | 2.3.0 | MIT |
| `json-schema-ref-resolver` | 3.0.0 | MIT |
| `json-schema-traverse` | 1.0.0 | MIT |
| `light-my-request` | 6.6.0 | BSD-3-Clause |
| `on-exit-leak-free` | 2.1.2 | MIT |
| `pino` | 10.3.1 | MIT |
| `pino-abstract-transport` | 3.0.0 | MIT |
| `pino-std-serializers` | 7.1.0 | MIT |
| `process-warning` | 4.0.1 | MIT |
| `process-warning` | 5.0.0 | MIT |
| `quick-format-unescaped` | 4.0.4 | MIT |
| `real-require` | 0.2.0 | MIT |
| `require-from-string` | 2.0.2 | MIT |
| `ret` | 0.5.0 | MIT |
| `reusify` | 1.1.0 | MIT |
| `rfdc` | 1.4.1 | MIT |
| `safe-regex2` | 5.1.1 | MIT |
| `safe-stable-stringify` | 2.5.0 | MIT |
| `secure-json-parse` | 4.1.0 | BSD-3-Clause |
| `semver` | 7.7.4 | ISC |
| `set-cookie-parser` | 2.7.2 | MIT |
| `sonic-boom` | 4.2.1 | MIT |
| `split2` | 4.2.0 | ISC |
| `thread-stream` | 4.0.0 | MIT |
| `toad-cache` | 3.7.0 | MIT |
| `zod` | 3.25.76 | MIT |
