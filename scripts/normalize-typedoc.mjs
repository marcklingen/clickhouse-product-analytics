import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'

const root = 'content/docs/reference/sdk-generated'
const rootAbs = resolve(root)
const routeBase = '/reference/sdk-generated'
const generatedFiles = new Set((await listMdxFiles(rootAbs)).map(normalizePath))

await normalizeDirectory(root)
await ensureMetaFiles()

async function normalizeDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await normalizeDirectory(path)
      continue
    }
    if (!entry.isFile() || !entry.name.endsWith('.mdx')) {
      continue
    }

    const content = await readFile(path, 'utf8')
    const normalizedContent = normalizeMdxLinks(content, path)

    if (normalizedContent.startsWith('---\n')) {
      if (normalizedContent !== content) {
        await writeFile(path, normalizedContent)
      }
      continue
    }

    const title = inferTitle(normalizedContent, path)
    await writeFile(path, `---\ntitle: ${JSON.stringify(title)}\ndescription: Generated TypeDoc reference.\n---\n\n${normalizedContent}`)
  }
}

async function ensureMetaFiles() {
  await writeJson(join(root, 'meta.json'), {
    title: 'Generated SDK and React Reference',
    pages: ['index', 'sdk', 'react']
  })
  await writeJson(join(root, 'sdk/meta.json'), {
    title: 'SDK',
    pages: ['src']
  })
  await writeJson(join(root, 'sdk/src/meta.json'), {
    title: 'SDK Source',
    pages: ['index', 'classes', 'functions', 'type-aliases', 'variables']
  })
  await writeJson(join(root, 'react/meta.json'), {
    title: 'React',
    pages: ['src']
  })
  await writeJson(join(root, 'react/src/meta.json'), {
    title: 'React Source',
    pages: ['index', 'functions', 'type-aliases', 'variables']
  })
}

async function listMdxFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const results = []

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

function inferTitle(content, path) {
  const heading = content.match(/^#\s+(.+)$/m)
  if (heading) {
    return stripMarkdown(heading[1])
  }

  const name = basename(path, '.mdx')
  if (name === 'index') {
    const parent = basename(dirname(path))
    if (parent === 'sdk-generated') {
      return 'Generated SDK and React Reference'
    }
    return titleCase(parent)
  }

  return titleCase(name)
}

function stripMarkdown(value) {
  return value
    .replaceAll('`', '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .trim()
}

function normalizeMdxLinks(content, sourceFile) {
  return content.replace(/\]\(([^)\s]+\.mdx(?:#[^)]+)?)\)/g, (_match, href) => {
    return `](${normalizeMdxHref(sourceFile, href)})`
  })
}

function normalizeMdxHref(sourceFile, href) {
  const hashIndex = href.indexOf('#')
  const linkPath = hashIndex === -1 ? href : href.slice(0, hashIndex)
  const hash = hashIndex === -1 ? '' : href.slice(hashIndex)
  const targetFile = resolveGeneratedTarget(sourceFile, linkPath)

  return `${routeFromGeneratedFile(targetFile)}${hash}`
}

function resolveGeneratedTarget(sourceFile, linkPath) {
  const target = normalizePath(resolve(dirname(sourceFile), linkPath))
  if (generatedFiles.has(target)) {
    return target
  }

  if (basename(target) === 'index.mdx') {
    let directory = dirname(target)
    while (isWithin(directory, rootAbs)) {
      const indexFile = normalizePath(join(directory, 'index.mdx'))
      if (generatedFiles.has(indexFile)) {
        return indexFile
      }
      directory = dirname(directory)
    }
  }

  throw new Error(`Unable to resolve generated TypeDoc link from ${sourceFile}: ${linkPath}`)
}

function routeFromGeneratedFile(file) {
  const relativePath = normalizePath(relative(rootAbs, file))
  const withoutExtension = relativePath.replace(/\.mdx$/, '')

  if (withoutExtension === 'index') {
    return `${routeBase}/`
  }
  if (withoutExtension.endsWith('/index')) {
    return `${routeBase}/${withoutExtension.slice(0, -'/index'.length)}/`
  }
  return `${routeBase}/${withoutExtension}/`
}

function normalizePath(path) {
  return path.replace(/\\/g, '/')
}

function isWithin(path, parent) {
  const relativePath = relative(parent, path)
  return relativePath === '' || (!relativePath.startsWith('..') && !relativePath.includes(':'))
}

function titleCase(value) {
  return relative(root, value)
    .split(/[\/_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}
