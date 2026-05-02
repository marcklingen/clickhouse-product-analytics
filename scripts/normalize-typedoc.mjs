import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'

const root = 'content/docs/reference/sdk-generated'

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
    if (content.startsWith('---\n')) {
      continue
    }

    const title = inferTitle(content, path)
    await writeFile(path, `---\ntitle: ${JSON.stringify(title)}\ndescription: Generated TypeDoc reference.\n---\n\n${content}`)
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
