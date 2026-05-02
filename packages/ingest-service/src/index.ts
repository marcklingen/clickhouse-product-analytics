import { ClickHouseAnalyticsWriter } from './clickhouse-writer.js'
import { loadConfig } from './config.js'
import { runMigrations } from './migrate.js'
import { createServer } from './server.js'

async function main(): Promise<void> {
  const config = loadConfig()
  if (process.env.MIGRATE_ON_START === 'true') {
    await runMigrations(config)
  }

  const app = await createServer({
    config,
    writer: new ClickHouseAnalyticsWriter(config)
  })

  await app.listen({
    host: config.host,
    port: config.port
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
