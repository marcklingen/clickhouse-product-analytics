import { loader, multiple } from 'fumadocs-core/source'
import { openapiPlugin, openapiSource } from 'fumadocs-openapi/server'
import { docs } from 'collections/server'
import { openapi } from '@/lib/openapi'

export const source = loader(
  multiple({
    docs: docs.toFumadocsSource(),
    openapi: await openapiSource(openapi, {
      baseDir: 'reference/api'
    })
  }),
  {
    baseUrl: '/',
    plugins: [openapiPlugin()]
  }
)
