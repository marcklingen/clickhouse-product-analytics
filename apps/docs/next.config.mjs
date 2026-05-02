import { createMDX } from 'fumadocs-mdx/next'

const docsBasePath = process.env.NEXT_PUBLIC_DOCS_BASE_PATH ?? process.env.DOCS_BASE_PATH ?? ''

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  trailingSlash: true,
  basePath: docsBasePath || undefined,
  assetPrefix: docsBasePath || undefined,
  images: {
    unoptimized: true
  },
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_DOCS_BASE_PATH: docsBasePath
  }
}

const withMDX = createMDX({
  configPath: './source.config.ts'
})

export default withMDX(config)
