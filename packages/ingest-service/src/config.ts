export type ServiceConfig = {
  host: string
  port: number
  logLevel: 'silent' | 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'
  publicApiKeys: Set<string>
  allowedOrigins: Set<string>
  maxBatchBytes: number
  maxEventsPerBatch: number
  clickhouse: {
    url: string
    username: string
    password?: string
    database: string
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServiceConfig {
  const publicApiKeys = csv(env.PUBLIC_API_KEYS)
  const allowedOrigins = csv(env.ALLOWED_ORIGINS)

  return {
    host: env.HOST ?? '0.0.0.0',
    port: numberEnv(env.PORT, 8080),
    logLevel: logLevelEnv(env.LOG_LEVEL, 'warn'),
    publicApiKeys: new Set(publicApiKeys),
    allowedOrigins: new Set(allowedOrigins),
    maxBatchBytes: numberEnv(env.MAX_BATCH_BYTES, 20 * 1024 * 1024),
    maxEventsPerBatch: numberEnv(env.MAX_EVENTS_PER_BATCH, 10_000),
    clickhouse: {
      url: env.CLICKHOUSE_URL ?? 'http://localhost:8123',
      username: env.CLICKHOUSE_USER ?? 'default',
      password: env.CLICKHOUSE_PASSWORD,
      database: env.CLICKHOUSE_DATABASE ?? 'product_analytics'
    }
  }
}

function logLevelEnv(value: string | undefined, fallback: ServiceConfig['logLevel']): ServiceConfig['logLevel'] {
  if (value === undefined || value === '') {
    return fallback
  }
  if (['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace'].includes(value)) {
    return value as ServiceConfig['logLevel']
  }
  throw new Error(`Invalid LOG_LEVEL value: ${value}`)
}

function csv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function numberEnv(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer value: ${value}`)
  }
  return parsed
}
