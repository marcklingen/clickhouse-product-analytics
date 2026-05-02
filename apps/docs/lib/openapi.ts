import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createOpenAPI } from 'fumadocs-openapi/server'
import { parse } from 'yaml'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export const openapiSpecPath = path.resolve(
  dirname,
  '../../../openapi/clickhouse-product-analytics.openapi.yaml'
)

export const openapiSpecInput = '../../openapi/clickhouse-product-analytics.openapi.yaml'

export const openapi = createOpenAPI({
  input: async () => ({
    [openapiSpecInput]: parse(await readFile(openapiSpecPath, 'utf8'))
  })
})
