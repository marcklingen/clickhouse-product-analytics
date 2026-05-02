import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient, type ClickHouseClient } from '@clickhouse/client'
import { loadConfig, type ServiceConfig } from './config.js'

export async function runMigrations(config: ServiceConfig = loadConfig()): Promise<void> {
  const client = createClient({
    url: config.clickhouse.url,
    username: config.clickhouse.username,
    password: config.clickhouse.password
  })

  try {
    const database = identifier(config.clickhouse.database)
    await client.command({
      query: `CREATE DATABASE IF NOT EXISTS ${database}`
    })
    await client.command({
      query: `
        CREATE TABLE IF NOT EXISTS ${database}.schema_migrations
        (
          filename String,
          applied_at DateTime64(6, 'UTC') DEFAULT now64()
        )
        ENGINE = MergeTree
        ORDER BY filename
      `
    })

    const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../migrations')
    const migrations = (await readdir(migrationsDir))
      .filter((file) => file.endsWith('.sql'))
      .sort()
    const applied = await appliedMigrations(client, database)

    for (const migration of migrations) {
      if (applied.has(migration)) {
        continue
      }
      const sql = (await readFile(join(migrationsDir, migration), 'utf8'))
        .replaceAll('{{DATABASE}}', database)
      for (const statement of splitSql(sql)) {
        await client.command({
          query: statement
        })
      }
      await client.command({
        query: `INSERT INTO ${database}.schema_migrations (filename) VALUES ({filename:String})`,
        query_params: {
          filename: migration
        }
      })
    }
  } finally {
    await client.close()
  }
}

async function appliedMigrations(client: ClickHouseClient, database: string): Promise<Set<string>> {
  const result = await client.query({
    query: `SELECT filename FROM ${database}.schema_migrations`,
    format: 'JSONEachRow'
  })
  const rows = await result.json<{ filename: string }>()
  return new Set(rows.map((row) => row.filename))
}

function identifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid ClickHouse identifier: ${value}`)
  }
  return value
}

function splitSql(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrations().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
