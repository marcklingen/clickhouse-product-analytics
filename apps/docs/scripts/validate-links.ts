import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
const contentRoot = join(process.cwd(), '../../content/docs')
const staticRoot = join(process.cwd(), 'out')
const knownRoutes = new Set<string>()
knownRoutes.add('/openapi.yaml')

const files = await listMdxFiles(contentRoot)
for (const file of files) {
  knownRoutes.add(routeFromContentFile(file))
}
for (const route of await listStaticRoutes(staticRoot)) {
  knownRoutes.add(route)
}

const errors: string[] = []

for (const file of files) {
  const content = await readFile(file, 'utf8')
  const withoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '')
  const links = [...withoutCodeBlocks.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]

  for (const [, rawHref] of links) {
    const href = rawHref.trim()
    if (!href || href.startsWith('http:') || href.startsWith('https:') || href.startsWith('mailto:') || href.startsWith('#')) {
      continue
    }
    const route = href.startsWith('/')
      ? normalizeRoute(href)
      : resolveRelativeRoute(file, href)
    if (!knownRoutes.has(route)) {
      errors.push(`${relative(contentRoot, file)} links to missing route: ${href}`)
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`Validated ${files.length} MDX files and ${knownRoutes.size} routes.`)

async function listMdxFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const results: string[] = []

  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      results.push(...await listMdxFiles(path))
    } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
      results.push(path)
    }
  }

  return results
}

function normalizeRoute(href: string): string {
  const withoutHash = href.split('#')[0]
  const withoutQuery = withoutHash.split('?')[0]
  if (withoutQuery === '/') {
    return '/'
  }
  return withoutQuery.replace(/\/+$/, '')
}

function resolveRelativeRoute(file: string, href: string): string {
  const withoutHash = href.split('#')[0]
  const withoutQuery = withoutHash.split('?')[0]
  const target = resolve(dirname(file), withoutQuery)

  if (withoutQuery.endsWith('.mdx')) {
    return routeFromContentFile(target)
  }

  const currentRoute = routeFromContentFile(file)
  const baseRoute = currentRoute === '/' ? '/' : `${currentRoute.slice(0, currentRoute.lastIndexOf('/') + 1)}`
  return normalizeRoute(new URL(withoutQuery, `https://docs.local${baseRoute}`).pathname)
}

function routeFromContentFile(file: string): string {
  const relativePath = relative(contentRoot, file).replace(/\\/g, '/')
  const withoutExtension = relativePath.replace(/\.mdx$/, '')
  if (withoutExtension === 'index') {
    return '/'
  }
  if (withoutExtension.endsWith('/index')) {
    return `/${withoutExtension.slice(0, -'/index'.length)}`
  }
  return `/${withoutExtension}`
}

async function listStaticRoutes(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true })
    const results: string[] = []

    for (const entry of entries) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        results.push(...await listStaticRoutes(path))
      } else if (entry.isFile() && entry.name === 'index.html') {
        const route = `/${relative(staticRoot, directory).replace(/\\/g, '/')}`.replace(/\/\.$/, '/')
        results.push(normalizeRoute(route))
      }
    }

    return results
  } catch {
    return []
  }
}
