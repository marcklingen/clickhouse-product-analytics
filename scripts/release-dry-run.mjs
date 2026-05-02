import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const cache = resolve('.npm-cache')
mkdirSync(cache, { recursive: true })

const env = {
  ...process.env,
  npm_config_cache: cache
}

const commands = [
  ['npm', ['run', 'release:check-version']],
  ['npm', ['run', 'verify']],
  ['npm', ['run', 'docs:reference']],
  ['git', ['diff', '--exit-code', 'docs/reference/sdk']],
  ['npm', ['pack', '--dry-run', '--workspace', '@clickhouse-product-analytics/sdk']],
  ['npm', ['pack', '--dry-run', '--workspace', '@clickhouse-product-analytics/react']],
  ['npm', ['publish', '--dry-run', '--workspace', '@clickhouse-product-analytics/sdk', '--access', 'public']],
  ['npm', ['publish', '--dry-run', '--workspace', '@clickhouse-product-analytics/react', '--access', 'public']]
]

for (const [command, args] of commands) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
