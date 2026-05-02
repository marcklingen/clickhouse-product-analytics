# Third-Party Notices

This project contains implementation elements informed by PostHog open source
projects. Where behavior or schema choices stay close enough to be treated as
derived for distribution purposes, this file preserves conservative notices.

## PostHog JS

Portions of the browser SDK behavior, including autocapture filtering and
client API compatibility behavior, are informed by PostHog JS.

Source: <https://github.com/PostHog/posthog-js>  
License: Apache License 2.0 for the browser package; MIT for the React package

Copyright 2020 Posthog / Hiberly, Inc.  
Copyright 2015 Mixpanel, Inc.

The Apache License 2.0 text is reproduced in this repository's `LICENSE` file.

## PostHog React Package

Portions of the React provider and hook ergonomics are inspired by or derived
from the React package in PostHog JS.

Source: <https://github.com/PostHog/posthog-js/tree/main/packages/react>  
License: MIT

Copyright (c) 2020-2025 PostHog, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## PostHog Backend

Portions of the ClickHouse event/person schema and ingest semantics are
informed by the open source portions of PostHog Backend.

Source: <https://github.com/PostHog/posthog>  
License: MIT Expat for content outside `ee/`

Copyright (c) 2020-2025 PostHog Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Excluded Material

No material from the PostHog Backend `ee/` directory is intentionally included.
That directory is governed by the PostHog Enterprise license and must not be
copied or derived from without an appropriate license.

## Container Production npm Dependencies

The ingest-service container image runs `npm prune --omit=dev` before copying
`node_modules` into the runtime image. This section inventories the production
npm dependency licenses represented by the pruned runtime dependency graph.
Individual package license files remain in `/app/node_modules`.

Generated from:

```bash
npm ls --omit=dev --all --json --workspace @clickhouse-product-analytics/ingest-service
```

### Apache-2.0

- `@clickhouse/client@1.18.3`
- `@clickhouse/client-common@1.18.3`

### BSD-3-Clause

- `fast-uri@3.1.0`
- `light-my-request@6.6.0`
- `secure-json-parse@4.1.0`

### ISC

- `fastq@1.20.1`
- `semver@7.7.4`
- `split2@4.2.0`

### MIT

- `@fastify/ajv-compiler@4.0.5`
- `@fastify/cors@11.2.0`
- `@fastify/error@4.2.0`
- `@fastify/fast-json-stringify-compiler@5.0.3`
- `@fastify/forwarded@3.0.1`
- `@fastify/merge-json-schemas@0.2.1`
- `@fastify/proxy-addr@5.1.0`
- `@pinojs/redact@0.4.0`
- `abstract-logging@2.0.1`
- `ajv@8.20.0`
- `ajv-formats@3.0.1`
- `atomic-sleep@1.0.0`
- `avvio@9.2.0`
- `cookie@1.1.1`
- `dequal@2.0.3`
- `fast-decode-uri-component@1.0.1`
- `fast-deep-equal@3.1.3`
- `fast-json-stringify@6.3.0`
- `fast-querystring@1.1.2`
- `fastify@5.8.5`
- `fastify-plugin@5.1.0`
- `find-my-way@9.5.0`
- `ipaddr.js@2.3.0`
- `json-schema-ref-resolver@3.0.0`
- `json-schema-traverse@1.0.0`
- `on-exit-leak-free@2.1.2`
- `pino@10.3.1`
- `pino-abstract-transport@3.0.0`
- `pino-std-serializers@7.1.0`
- `process-warning@4.0.1`
- `process-warning@5.0.0`
- `quick-format-unescaped@4.0.4`
- `react@19.2.5`
- `real-require@0.2.0`
- `require-from-string@2.0.2`
- `ret@0.5.0`
- `reusify@1.1.0`
- `rfdc@1.4.1`
- `safe-regex2@5.1.1`
- `safe-stable-stringify@2.5.0`
- `set-cookie-parser@2.7.2`
- `sonic-boom@4.2.1`
- `thread-stream@4.0.0`
- `toad-cache@3.7.0`
- `zod@3.25.76`
