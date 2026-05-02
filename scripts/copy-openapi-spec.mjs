import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const source = resolve('openapi/clickhouse-product-analytics.openapi.yaml')
const destination = resolve('apps/docs/public/openapi.yaml')

await mkdir(dirname(destination), { recursive: true })
await copyFile(source, destination)

const [sourceContent, destinationContent] = await Promise.all([
  readFile(source, 'utf8'),
  readFile(destination, 'utf8')
])

if (sourceContent !== destinationContent) {
  throw new Error('Copied OpenAPI spec does not match committed source')
}
