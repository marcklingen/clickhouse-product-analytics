import { readFile } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import { gzipSync } from 'node:zlib'
import { JSDOM } from 'jsdom'
import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '../packages/sdk/dist/index.js'
import {
  AnalyticsCaptureOnViewed,
  AnalyticsProvider,
  useAnalytics
} from '../packages/react/dist/index.js'

const serviceUrl = process.env.CPA_SERVICE_URL ?? 'http://127.0.0.1:8080'
const clickhouseUrl = process.env.CLICKHOUSE_URL ?? 'http://127.0.0.1:8123'
const clickhouseUser = process.env.CLICKHOUSE_USER ?? 'analytics'
const clickhousePassword = process.env.CLICKHOUSE_PASSWORD ?? 'local_dev_password'
const database = identifier(process.env.CLICKHOUSE_DATABASE ?? 'product_analytics')
const apiKey = process.env.CPA_API_KEY ?? 'local_dev_key'
const runId = `e2e_${Date.now()}`

await assertDocsDeploymentWiring()
await waitForHealth(`${serviceUrl}/health`, 'ingest service')
await waitForHealth(`${clickhouseUrl}/ping`, 'ClickHouse')

const browser = await runBrowserSdkFlow()
const pageLifecycle = await runPageLifecycleFlow()
const react = await runReactFlow()
const direct = await runDirectApiFlow()
await assertRejectedRequests()
await assertClickHouseTables()
const summary = await assertStoredData({ browser, pageLifecycle, react, direct })
await assertStarterQueries({ browser, direct })

console.log(JSON.stringify({
  status: 'ok',
  runId,
  ...summary
}, null, 2))

async function runBrowserSdkFlow() {
  const dom = installDom('http://localhost:3000/docs/start')
  const client = createClient()
  const userId = `user_${runId}`

  try {
    client.init({
      apiHost: serviceUrl,
      capturePageview: 'history_change',
      autocapture: {
        captureText: true,
        elementAllowlist: ['button', 'a']
      },
      propertyDenylist: ['secret'],
      beforeSend: [
        (event) => event.event === 'before_send_drop' ? undefined : event,
        (event) => {
          if (event.event === 'before_send_mutated') {
            event.properties.before_send_marker = 'mutated'
          }
          return event
        }
      ],
      persistence: 'localStorage+cookie',
      flushAt: 10,
      flushIntervalMs: 250
    })

    client.register({
      run_id: runId,
      documented_flow: 'browser-sdk'
    })
    const anonymousId = client.get_distinct_id()
    client.capture('signup_started', {
      plan: 'pro',
      secret: 'not stored'
    })
    client.capture('before_send_mutated', {
      run_id: runId
    })
    client.capture('before_send_drop', {
      run_id: runId
    })
    client.opt_out_capturing()
    client.capture('opted_out_event', {
      run_id: runId
    })
    client.opt_in_capturing()
    client.capture('opted_in_event', {
      run_id: runId
    })
    client.identify(userId, {
      email: `${runId}@example.com`
    }, {
      first_seen_source: 'browser-sdk'
    })

    window.history.pushState({}, '', '/docs/pricing')
    document.body.innerHTML = '<button id="signup-button" class="primary">Sign up</button>'
    document.querySelector('#signup-button')?.dispatchEvent(new window.MouseEvent('click', {
      bubbles: true,
      cancelable: true
    }))
    await client.flush()

    return {
      anonymousId,
      userId,
      sessionId: client.get_session_id()
    }
  } finally {
    client.shutdown()
    dom.restore()
  }
}

async function withBrowserClient(url, options, callback) {
  const dom = installDom(url)
  const client = createClient()
  try {
    client.init({
      apiHost: serviceUrl,
      persistence: 'memory',
      flushIntervalMs: 250,
      ...options
    })
    await callback({ client, window })
  } finally {
    client.shutdown()
    dom.restore()
  }
}

async function runPageLifecycleFlow() {
  const enabledFlow = `page_lifecycle_enabled_${runId}`
  const disabledFlow = `page_lifecycle_disabled_${runId}`

  await withBrowserClient('http://localhost:3000/page-lifecycle-enabled', {
    capturePageview: true,
    capturePageleave: true,
    beforeSend: (event) => {
      event.properties.run_id = runId
      event.properties.lifecycle_flow = enabledFlow
      return event
    }
  }, async ({ client }) => {
    window.dispatchEvent(new window.Event('pagehide'))
    await waitForCount(`SELECT count() AS count FROM ${database}.events WHERE JSONExtractString(properties, 'lifecycle_flow') = '${enabledFlow}' AND event = '$pageleave'`, 1)
    await client.flush()
  })

  await withBrowserClient('http://localhost:3000/page-lifecycle-disabled', {
    capturePageview: false,
    capturePageleave: 'if_capture_pageview',
    beforeSend: (event) => {
      event.properties.run_id = runId
      event.properties.lifecycle_flow = disabledFlow
      return event
    }
  }, async ({ client }) => {
    window.dispatchEvent(new window.Event('pagehide'))
    await sleep(250)
    await client.flush()
  })

  return {
    enabledFlow,
    disabledFlow
  }
}

async function runReactFlow() {
  const dom = installDom('http://localhost:3000/react')
  const hookEvent = `react_hook_${runId}`
  const viewedEvent = `react_viewed_${runId}`
  const childViewedEvent = `react_child_viewed_${runId}`
  const root = createRoot(document.getElementById('root'))

  function HookCapture() {
    const analytics = useAnalytics()
    useEffect(() => {
      if (!analytics) {
        return
      }
      analytics.register({
        run_id: runId,
        documented_flow: 'react'
      })
      analytics.capture(hookEvent, {
        source: 'useAnalytics'
      })
      void analytics.flush().catch(() => undefined)
    }, [analytics])
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        AnalyticsCaptureOnViewed,
        {
          name: 'product-card',
          eventName: viewedEvent,
          properties: {
            run_id: runId,
            product_id: 'sku_123'
          }
        },
        React.createElement('button', {
          type: 'button',
          onClick: () => analytics?.capture('product_clicked', {
            run_id: runId,
            product_id: 'sku_123'
          })
        }, 'View product')
      ),
      React.createElement(
        AnalyticsCaptureOnViewed,
        {
          name: 'product-list',
          eventName: childViewedEvent,
          trackAllChildren: true,
          properties: {
            run_id: runId
          }
        },
        [
          React.createElement('span', { key: 'a' }, 'First product'),
          React.createElement('span', { key: 'b' }, 'Second product')
        ]
      )
    )
  }

  try {
    root.render(
      React.createElement(
        AnalyticsProvider,
        {
          options: {
            apiHost: serviceUrl,
            capturePageview: false,
            persistence: 'memory',
            flushIntervalMs: 250
          }
        },
        React.createElement(HookCapture)
      )
    )

    await waitForCount(
      `SELECT count() AS count FROM ${database}.events WHERE JSONExtractString(properties, 'run_id') = '${runId}' AND event IN ('${hookEvent}', '${viewedEvent}')`,
      2
    )
    await waitForCount(
      `SELECT count() AS count FROM ${database}.events WHERE JSONExtractString(properties, 'run_id') = '${runId}' AND event = '${childViewedEvent}'`,
      2
    )
    return {
      hookEvent,
      viewedEvent,
      childViewedEvent
    }
  } finally {
    root.unmount()
    await sleep(50)
    dom.restore()
  }
}

async function runDirectApiFlow() {
  const directDistinctId = `backend_${runId}`
  const batchDistinctId = `batch_${runId}`
  const knownDistinctId = `known_${runId}`
  const anonymousDistinctId = `anon_${runId}`
  const historicalKnownDistinctId = `historical_known_${runId}`
  const historicalAnonymousDistinctId = `historical_anon_${runId}`
  const sessionId = `session_${runId}`

  await postJson(`${serviceUrl}/batch/`, batchPayload(apiKey, {
    event: 'backend_job_completed',
    distinct_id: directDistinctId,
    properties: {
      run_id: runId,
      source: 'direct-api',
      job_id: 'job_456',
      duration_ms: 481
    }
  }))

  await postJson(`${serviceUrl}/batch/`, {
    batch: [
      {
        event: 'allowed_origin_event',
        distinct_id: directDistinctId,
        properties: {
          run_id: runId,
          source: 'allowed-origin'
        }
      }
    ]
  }, {
    origin: 'http://localhost:3000'
  })

  await postGzipJson(`${serviceUrl}/batch/`, batchPayload(apiKey, {
    event: 'gzip_event',
    distinct_id: directDistinctId,
    properties: {
      run_id: runId,
      source: 'gzip'
    }
  }))

  await postJson(`${serviceUrl}/batch/`, batchPayload(apiKey, {
    event: 'historical_signup_started',
    distinct_id: historicalAnonymousDistinctId,
    properties: {
      run_id: runId,
      source: 'direct-api',
      identity_flow: 'separate-requests'
    }
  }))

  await postJson(`${serviceUrl}/batch/`, batchPayload(apiKey, {
    event: '$identify',
    distinct_id: historicalKnownDistinctId,
    properties: {
      run_id: runId,
      '$anon_distinct_id': historicalAnonymousDistinctId,
      identity_flow: 'separate-requests',
      '$set': {
        email: `historical-${runId}@example.com`
      }
    }
  }))

  await postJson(`${serviceUrl}/batch/`, {
    api_key: apiKey,
    batch: [
      {
        event: '$pageview',
        distinct_id: batchDistinctId,
        properties: {
          run_id: runId,
          '$current_url': 'https://example.com/',
          '$host': 'example.com',
          '$session_id': sessionId
        }
      },
      {
        event: '$identify',
        distinct_id: knownDistinctId,
        properties: {
          run_id: runId,
          '$anon_distinct_id': anonymousDistinctId,
          '$set': {
            email: `${runId}@example.com`,
            plan: 'developer'
          },
          '$set_once': {
            first_seen_source: 'direct-api'
          }
        }
      },
      {
        event: '$set',
        distinct_id: knownDistinctId,
        properties: {
          run_id: runId,
          '$set': {
            plan: 'enterprise'
          },
          '$set_once': {
            first_seen_source: 'should-not-overwrite'
          }
        }
      }
    ]
  })

  return {
    directDistinctId,
    batchDistinctId,
    knownDistinctId,
    anonymousDistinctId,
    historicalKnownDistinctId,
    historicalAnonymousDistinctId,
    sessionId
  }
}

async function assertRejectedRequests() {
  await expectStatus(`${serviceUrl}/batch/`, batchPayload('invalid_key', {
    event: 'invalid_key_event',
    distinct_id: `invalid_${runId}`,
    properties: {
      run_id: runId
    }
  }), 401)

  await expectStatus(`${serviceUrl}/batch/`, {
    batch: [
      {
        event: 'missing_key_no_origin_event',
        distinct_id: `missing_key_${runId}`,
        properties: {
          run_id: runId
        }
      }
    ]
  }, 401)

  await expectStatus(`${serviceUrl}/batch/`, batchPayload(apiKey, {
    event: 'blocked_origin_event',
    distinct_id: `blocked_${runId}`,
    properties: {
      run_id: runId
    }
  }), 403, {
    origin: 'https://not-allowed.example'
  })

  await expectStatus(`${serviceUrl}/batch/`, {
    api_key: apiKey,
    batch: Array.from({ length: 10_001 }, (_value, index) => ({
      event: 'too_many_events',
      distinct_id: `too_many_${runId}_${index}`,
      properties: {
        run_id: runId
      }
    }))
  }, 413)
}

async function assertStoredData({ browser, pageLifecycle, react, direct }) {
  await waitForCount(`SELECT count() AS count FROM ${database}.events WHERE JSONExtractString(properties, 'run_id') = '${runId}'`, 10)
  await waitForCount(`SELECT count() AS count FROM ${database}.persons FINAL WHERE distinct_id IN ('${browser.userId}', '${direct.knownDistinctId}', '${direct.historicalKnownDistinctId}')`, 3)
  await waitForCount(`SELECT count() AS count FROM ${database}.person_distinct_ids FINAL WHERE distinct_id IN ('${direct.knownDistinctId}', '${direct.anonymousDistinctId}', '${direct.historicalKnownDistinctId}', '${direct.historicalAnonymousDistinctId}')`, 4)

  assertCount(
    'browser SDK custom event',
    await queryCount(`SELECT count() AS count FROM ${database}.events WHERE event = 'signup_started' AND JSONExtractString(properties, 'run_id') = '${runId}'`),
    1
  )
  assertCount(
    'history-change pageview',
    await queryCount(`SELECT count() AS count FROM ${database}.events WHERE event = '$pageview' AND JSONExtractString(properties, 'run_id') = '${runId}' AND current_url LIKE '%/docs/pricing%'`),
    1
  )
  assertCount(
    'autocapture button event',
    await queryCount(`SELECT count() AS count FROM ${database}.events WHERE event = '$autocapture' AND JSONExtractString(properties, 'run_id') = '${runId}' AND JSONExtractString(properties, '$el_text') = 'Sign up'`),
    1
  )
  assertCount(
    'property denylist',
    await queryCount(`SELECT count() AS count FROM ${database}.events WHERE event = 'signup_started' AND JSONExtractString(properties, 'run_id') = '${runId}' AND JSONHas(properties, 'secret')`),
    0,
    'exact'
  )
  const browserIdentityRows = await queryRows(`
    SELECT event, person_id
    FROM ${database}.events
    WHERE event IN ('signup_started', '$identify')
      AND JSONExtractString(properties, 'run_id') = '${runId}'
      AND distinct_id IN ('${browser.anonymousId}', '${browser.userId}')
    ORDER BY event
  `)
  assert(
    browserIdentityRows.length === 2 && browserIdentityRows[0].person_id === browserIdentityRows[1].person_id,
    'Expected pre-identify browser events to share the identified person_id'
  )
  assertCount(
    'before_send mutation',
    await queryCount(`SELECT count() AS count FROM ${database}.events WHERE event = 'before_send_mutated' AND JSONExtractString(properties, 'run_id') = '${runId}' AND JSONExtractString(properties, 'before_send_marker') = 'mutated'`),
    1
  )
  assertCount(
    'before_send drop',
    await queryCount(`SELECT count() AS count FROM ${database}.events WHERE event = 'before_send_drop' AND JSONExtractString(properties, 'run_id') = '${runId}'`),
    0,
    'exact'
  )
  assertCount(
    'opt-out capture suppression',
    await queryCount(`SELECT count() AS count FROM ${database}.events WHERE event = 'opted_out_event' AND JSONExtractString(properties, 'run_id') = '${runId}'`),
    0,
    'exact'
  )
  assertCount(
    'opt-in capture resume',
    await queryCount(`SELECT count() AS count FROM ${database}.events WHERE event = 'opted_in_event' AND JSONExtractString(properties, 'run_id') = '${runId}'`),
    1
  )
  assertCount(
    'capturePageview true',
    await queryCount(`SELECT count() AS count FROM ${database}.events WHERE event = '$pageview' AND JSONExtractString(properties, 'lifecycle_flow') = '${pageLifecycle.enabledFlow}'`),
    1
  )
  assertCount(
    'capturePageleave true',
    await queryCount(`SELECT count() AS count FROM ${database}.events WHERE event = '$pageleave' AND JSONExtractString(properties, 'lifecycle_flow') = '${pageLifecycle.enabledFlow}'`),
    1
  )
  assertCount(
    'capturePageview false',
    await queryCount(`SELECT count() AS count FROM ${database}.events WHERE event = '$pageview' AND JSONExtractString(properties, 'lifecycle_flow') = '${pageLifecycle.disabledFlow}'`),
    0,
    'exact'
  )
  assertCount(
    'capturePageleave if_capture_pageview disabled',
    await queryCount(`SELECT count() AS count FROM ${database}.events WHERE event = '$pageleave' AND JSONExtractString(properties, 'lifecycle_flow') = '${pageLifecycle.disabledFlow}'`),
    0,
    'exact'
  )
  assertCount(
    'React hook event',
    await queryCount(`SELECT count() AS count FROM ${database}.events WHERE event = '${react.hookEvent}' AND JSONExtractString(properties, 'run_id') = '${runId}'`),
    1
  )
  assertCount(
    'React viewport event',
    await queryCount(`SELECT count() AS count FROM ${database}.events WHERE event = '${react.viewedEvent}' AND JSONExtractString(properties, 'run_id') = '${runId}' AND JSONExtractString(properties, 'product_id') = 'sku_123'`),
    1
  )
  assertCount(
    'React trackAllChildren viewport events',
    await queryCount(`SELECT count() AS count FROM ${database}.events WHERE event = '${react.childViewedEvent}' AND JSONExtractString(properties, 'run_id') = '${runId}'`),
    2
  )
  assertCount(
    'direct API single event',
    await queryCount(`SELECT count() AS count FROM ${database}.events WHERE event = 'backend_job_completed' AND distinct_id = '${direct.directDistinctId}' AND JSONExtractString(properties, 'job_id') = 'job_456'`),
    1
  )
  assertCount(
    'allowed browser origin event',
    await queryCount(`SELECT count() AS count FROM ${database}.events WHERE event = 'allowed_origin_event' AND JSONExtractString(properties, 'run_id') = '${runId}'`),
    1
  )
  assertCount(
    'gzip encoded request',
    await queryCount(`SELECT count() AS count FROM ${database}.events WHERE event = 'gzip_event' AND JSONExtractString(properties, 'run_id') = '${runId}'`),
    1
  )
  assertCount(
    'direct API historical anonymous event',
    await queryCount(`SELECT count() AS count FROM ${database}.events WHERE event = 'historical_signup_started' AND distinct_id = '${direct.historicalAnonymousDistinctId}' AND JSONExtractString(properties, 'identity_flow') = 'separate-requests'`),
    1
  )
  assertCount(
    'direct API batch pageview',
    await queryCount(`SELECT count() AS count FROM ${database}.events WHERE event = '$pageview' AND distinct_id = '${direct.batchDistinctId}' AND session_id = '${direct.sessionId}'`),
    1
  )

  const personRows = await queryRows(`
    SELECT properties
    FROM ${database}.persons FINAL
    WHERE distinct_id = '${direct.knownDistinctId}'
    LIMIT 1
  `)
  const personProperties = JSON.parse(personRows[0]?.properties ?? '{}')
  assert(personProperties.plan === 'enterprise', 'Expected $set to update person property `plan`')
  assert(personProperties.first_seen_source === 'direct-api', 'Expected $set_once to preserve the first value')

  const aliasRows = await queryRows(`
    SELECT person_id
    FROM ${database}.person_distinct_ids FINAL
    WHERE distinct_id IN ('${direct.knownDistinctId}', '${direct.anonymousDistinctId}')
    ORDER BY distinct_id
  `)
  assert(aliasRows.length === 2 && aliasRows[0].person_id === aliasRows[1].person_id, 'Expected identify to link anonymous and known distinct IDs')

  const historicalIdentityRows = await queryRows(`
    SELECT event, person_id
    FROM ${database}.events
    WHERE event IN ('historical_signup_started', '$identify')
      AND JSONExtractString(properties, 'identity_flow') = 'separate-requests'
      AND distinct_id IN ('${direct.historicalAnonymousDistinctId}', '${direct.historicalKnownDistinctId}')
    ORDER BY event
  `)
  assert(
    historicalIdentityRows.length === 2 && historicalIdentityRows[0].person_id === historicalIdentityRows[1].person_id,
    'Expected later identify to reuse the earlier anonymous person_id across separate requests'
  )

  const historicalAliasRows = await queryRows(`
    SELECT person_id
    FROM ${database}.person_distinct_ids FINAL
    WHERE distinct_id IN ('${direct.historicalKnownDistinctId}', '${direct.historicalAnonymousDistinctId}')
    ORDER BY distinct_id
  `)
  assert(
    historicalAliasRows.length === 2 && historicalAliasRows[0].person_id === historicalAliasRows[1].person_id,
    'Expected separate-request identify to link anonymous and known distinct IDs'
  )

  const sessionRows = await queryRows(`
    SELECT event_count, pageview_count, autocapture_count
    FROM ${database}.sessions
    WHERE session_id IN ('${browser.sessionId}', '${direct.sessionId}')
    ORDER BY session_id
  `)
  assert(sessionRows.length >= 2, 'Expected sessions view rows for browser and direct API sessions')
  assert(sessionRows.some((row) => Number(row.pageview_count) >= 1), 'Expected sessions view to count pageviews')
  assert(sessionRows.some((row) => Number(row.autocapture_count) >= 1), 'Expected sessions view to count autocapture events')

  return {
    events: await queryCount(`SELECT count() AS count FROM ${database}.events WHERE JSONExtractString(properties, 'run_id') = '${runId}'`),
    persons: await queryCount(`SELECT count() AS count FROM ${database}.persons FINAL WHERE distinct_id IN ('${browser.userId}', '${direct.knownDistinctId}', '${direct.historicalKnownDistinctId}')`),
    sessions: sessionRows.length
  }
}

async function assertStarterQueries({ browser, direct }) {
  const dailyRows = await queryRows(`
    SELECT
      toDate(timestamp) AS day,
      count() AS events,
      uniqExact(person_id) AS people
    FROM ${database}.events
    WHERE JSONExtractString(properties, 'run_id') = '${runId}'
    GROUP BY day
    ORDER BY day
  `)
  assert(dailyRows.length >= 1 && Number(dailyRows[0].events) >= 1, 'Expected daily event/person starter query to return rows')

  const topEventRows = await queryRows(`
    SELECT
      event,
      count() AS count
    FROM ${database}.events
    WHERE timestamp >= now() - INTERVAL 7 DAY
      AND JSONExtractString(properties, 'run_id') = '${runId}'
    GROUP BY event
    ORDER BY count DESC
  `)
  assert(topEventRows.length >= 1, 'Expected top events starter query to return rows')

  const recentSessionRows = await queryRows(`
    SELECT
      session_id,
      started_at,
      ended_at,
      duration_seconds,
      pageview_count,
      autocapture_count,
      event_count
    FROM ${database}.sessions
    WHERE session_id IN ('${browser.sessionId}', '${direct.sessionId}')
    ORDER BY ended_at DESC
    LIMIT 50
  `)
  assert(recentSessionRows.length >= 2, 'Expected recent sessions starter query to return rows')

  const personSummaryRows = await queryRows(`
    SELECT
      person_id,
      min(timestamp) AS first_seen,
      max(timestamp) AS last_seen,
      countIf(event = '$pageview') AS pageviews,
      count() AS total_events
    FROM ${database}.events
    WHERE JSONExtractString(properties, 'run_id') = '${runId}'
    GROUP BY person_id
    ORDER BY last_seen DESC
    LIMIT 50
  `)
  assert(personSummaryRows.length >= 1, 'Expected person summary starter query to return rows')
}

async function assertClickHouseTables() {
  const rows = await queryRows(`
    SELECT name
    FROM system.tables
    WHERE database = '${database}'
      AND name IN ('events', 'persons', 'person_distinct_ids', 'sessions')
    ORDER BY name
  `)
  const names = new Set(rows.map((row) => row.name))
  for (const name of ['events', 'persons', 'person_distinct_ids', 'sessions']) {
    assert(names.has(name), `Expected ClickHouse table/view ${name} to exist`)
  }
}

async function assertDocsDeploymentWiring() {
  const [docs, architecture, deployment, railway, helmDocs, sendingEvents, identifyingUsers, schema, sdkStability, verification, reference, apiReference, sdkReference, publishing, agentSkillDocs, config, pagesWorkflow, ciWorkflow, containerWorkflow, dockerfile, releaseConfig, releaseSync, chart, values, compose] = await Promise.all([
    readFile('docs/index.md', 'utf8'),
    readFile('docs/architecture.md', 'utf8'),
    readFile('docs/deployment.md', 'utf8'),
    readFile('docs/railway.md', 'utf8'),
    readFile('docs/helm.md', 'utf8'),
    readFile('docs/sending-events.md', 'utf8'),
    readFile('docs/identifying-users.md', 'utf8'),
    readFile('docs/clickhouse-schema.md', 'utf8'),
    readFile('docs/sdk-stability.md', 'utf8'),
    readFile('docs/verification.md', 'utf8'),
    readFile('docs/reference/index.md', 'utf8'),
    readFile('docs/reference/http-api.md', 'utf8'),
    readFile('docs/reference/sdk/README.md', 'utf8'),
    readFile('docs/publishing.md', 'utf8'),
    readFile('docs/agent-skill.md', 'utf8'),
    readFile('docs/_config.yml', 'utf8'),
    readFile('.github/workflows/pages.yml', 'utf8'),
    readFile('.github/workflows/ci.yml', 'utf8'),
    readFile('.github/workflows/container.yml', 'utf8'),
    readFile('packages/ingest-service/Dockerfile', 'utf8'),
    readFile('.release-it.json', 'utf8'),
    readFile('scripts/sync-release-version.mjs', 'utf8'),
    readFile('deploy/helm/clickhouse-product-analytics/Chart.yaml', 'utf8'),
    readFile('deploy/helm/clickhouse-product-analytics/values.yaml', 'utf8'),
    readFile('docker-compose.yml', 'utf8')
  ])

  assert(docs.startsWith('---\n'), 'Expected docs/index.md to have frontmatter for GitHub Pages')
  assert(docs.includes('# ClickHouse Product Analytics'), 'Expected docs/index.md to contain the docs page heading')
  for (const link of [
    './architecture.md',
    './deployment.md',
    './railway.md',
    './helm.md',
    './sending-events.md',
    './identifying-users.md',
    './clickhouse-schema.md',
    './sdk-stability.md',
    './reference/index.md',
    './publishing.md',
    './agent-skill.md',
    './verification.md'
  ]) {
    assert(docs.includes(link), `Expected docs/index.md to link to ${link}`)
  }
  assert(architecture.includes('# Architecture') && architecture.includes('HTTP ingest service'), 'Expected architecture docs to describe the ingest architecture')
  assert(deployment.includes('# Deployment') && deployment.includes('PUBLIC_API_KEYS'), 'Expected deployment docs to describe environment configuration')
  assert(deployment.includes('clickhouse/clickhouse-server:26.3.9.8-alpine'), 'Expected deployment docs to state the pinned stable ClickHouse image')
  assert(deployment.includes('node dist/migrate.js'), 'Expected deployment docs to include production-image migration command')
  assert(railway.includes('# Railway Deployment') && railway.includes('CLICKHOUSE_URL'), 'Expected Railway docs to describe deployment configuration')
  assert(railway.includes('node dist/migrate.js'), 'Expected Railway docs to include production-image migration command')
  assert(helmDocs.includes('# Helm Deployment') && helmDocs.includes('autoscaling'), 'Expected Helm docs to describe Kubernetes deployment and autoscaling')
  assert(helmDocs.includes('node dist/migrate.js'), 'Expected Helm docs to include production-image migration command')
  assert(sendingEvents.includes('# Sending Events') && sendingEvents.includes('Browser SDK') && sendingEvents.includes('Batch API') && sendingEvents.includes('./reference/http-api.md'), 'Expected event docs to describe SDK/API usage and link references')
  assert(identifyingUsers.includes('# Identifying Users') && identifyingUsers.includes('$set_once'), 'Expected identity docs to describe user identification')
  assert(schema.includes('# ClickHouse Schema') && schema.includes('Agent Query Guidelines') && schema.includes('person_distinct_ids'), 'Expected schema docs to help agents query ClickHouse')
  assert(sdkStability.includes('# SDK Stability Review') && sdkStability.includes('CompressionStream'), 'Expected SDK stability docs to capture implementation review findings')
  assert(verification.includes('# Verification') && verification.includes('npm run verify:e2e') && verification.includes('npm run release:dry-run') && verification.includes('helm lint'), 'Expected verification docs to describe E2E, release, and Helm coverage')
  assert(reference.includes('# Reference') && reference.includes('./http-api.md') && reference.includes('./sdk/README.md'), 'Expected reference index to link API and SDK references')
  assert(apiReference.includes('# HTTP API Reference') && apiReference.includes('/batch/') && apiReference.includes('content-encoding: gzip'), 'Expected HTTP API reference to document endpoints and compression')
  assert(!apiReference.includes('/capture/') && !apiReference.includes('/i/v0/e/') && !apiReference.includes('compression=gzip-js') && !apiReference.includes('content-encoding: deflate'), 'Expected HTTP API reference to omit removed ingest aliases and compression modes')
  assert(sendingEvents.includes('apiHost') && !sendingEvents.includes('api_host'), 'Expected sending events docs to use camelCase SDK configuration')
  assert(sdkReference.includes('SDK and React Reference') && sdkReference.includes('sdk/src') && sdkReference.includes('react/src'), 'Expected generated SDK reference docs to exist')
  assert(publishing.includes('# Publishing Packages') && publishing.includes('@clickhouse-product-analytics/sdk') && publishing.includes('@clickhouse-product-analytics/react'), 'Expected publishing docs to cover SDK and React packages')
  assert(publishing.includes('clean working tree') && publishing.includes('npm whoami') && publishing.includes('--otp') && publishing.includes('provenance'), 'Expected publishing docs to cover release and registry prerequisites')
  assert(agentSkillDocs.includes('# Coding Agent Skill') && agentSkillDocs.includes('skills/product-analytics-tracking/SKILL.md'), 'Expected docs to reference the repo-local tracking skill')
  assert(config.includes('theme: jekyll-theme-primer'), 'Expected docs/_config.yml to configure the Pages theme')
  assert(pagesWorkflow.includes('actions/jekyll-build-pages@v1'), 'Expected Pages workflow to build Markdown docs with Jekyll')
  assert(pagesWorkflow.includes('source: ./docs'), 'Expected Pages workflow to publish docs/ as the source')
  assert(pagesWorkflow.includes('actions/deploy-pages@v4'), 'Expected Pages workflow to deploy to GitHub Pages')
  assert(pagesWorkflow.includes('compareCommitsWithBasehead') && pagesWorkflow.includes('pr-preview/pr-${{ github.event.pull_request.number }}') && pagesWorkflow.includes('clickhouse-product-analytics-docs-preview'), 'Expected Pages workflow to deploy and comment on PR docs previews')
  assert(ciWorkflow.includes('npm run verify:e2e') && ciWorkflow.includes('helm lint') && ciWorkflow.includes('helm template') && ciWorkflow.includes('git diff --exit-code docs/reference/sdk'), 'Expected CI workflow to run E2E, Helm, and generated docs checks')
  assert(containerWorkflow.includes('workflow_run') && containerWorkflow.includes('CI') && containerWorkflow.includes("workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push'") && containerWorkflow.includes('Verify current main commit') && !containerWorkflow.includes('workflow_dispatch'), 'Expected container workflow to publish only after CI succeeds on the current main push')
  assert(containerWorkflow.includes('ghcr.io/${{ github.repository }}/ingest-service') && containerWorkflow.includes('docker/build-push-action@v6'), 'Expected container workflow to publish the ingest image to GHCR')
  assert(dockerfile.includes('node:22-alpine@sha256:') && dockerfile.includes('RUN npm ci') && dockerfile.includes('LICENSE THIRD_PARTY_NOTICES.md ATTRIBUTION.md'), 'Expected Dockerfile to pin Node, use lockfile install, and include notice files')
  assert(releaseConfig.includes('scripts/sync-release-version.mjs ${version}') && releaseSync.includes("dependencies['@clickhouse-product-analytics/sdk'] = version") && releaseSync.includes('packages/sdk/src/version.ts'), 'Expected release tooling to keep React, SDK, and runtime package versions aligned')
  assert(chart.includes('name: clickhouse-product-analytics'), 'Expected Helm chart metadata to exist')
  assert(values.includes('autoscaling:') && values.includes('targetCPUUtilizationPercentage: 70') && values.includes('digest: ""'), 'Expected Helm values to configure autoscaling defaults and digest-pinned images')
  assert(compose.includes('clickhouse/clickhouse-server:26.3.9.8-alpine'), 'Expected docker-compose.yml to pin the stable ClickHouse image')
}

async function waitForHealth(url, name) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url, clickhouseFetchOptions(url))
      if (response.ok) {
        return
      }
    } catch {
      // retry
    }
    await sleep(1000)
  }
  throw new Error(`${name} did not become healthy at ${url}`)
}

async function waitForCount(query, expected = 1) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await queryCount(query)
    if (result >= expected) {
      return result
    }
    await sleep(1000)
  }
  return queryCount(query)
}

async function queryCount(query) {
  const rows = await queryRows(query)
  return Number(rows[0]?.count ?? 0)
}

async function queryRows(query) {
  const url = `${clickhouseUrl}/?query=${encodeURIComponent(`${query} FORMAT JSONEachRow`)}`
  const response = await fetch(url, clickhouseFetchOptions(url))
  if (!response.ok) {
    throw new Error(`ClickHouse query failed with HTTP ${response.status}: ${await response.text()}`)
  }
  const text = (await response.text()).trim()
  if (!text) {
    return []
  }
  return text.split('\n').map((line) => JSON.parse(line))
}

function clickhouseFetchOptions(url) {
  if (!url.startsWith(clickhouseUrl) || !clickhouseUser) {
    return undefined
  }
  return {
    headers: {
      authorization: `Basic ${Buffer.from(`${clickhouseUser}:${clickhousePassword}`).toString('base64')}`
    }
  }
}

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  })
  if (!response.ok) {
    throw new Error(`POST ${url} failed with HTTP ${response.status}: ${await response.text()}`)
  }
  return response.json()
}

async function postGzipJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-encoding': 'gzip'
    },
    body: gzipSync(JSON.stringify(body))
  })
  if (!response.ok) {
    throw new Error(`POST ${url} gzip failed with HTTP ${response.status}: ${await response.text()}`)
  }
  return response.json()
}

async function expectStatus(url, body, status, headers = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  })
  assert(response.status === status, `Expected POST ${url} to return HTTP ${status}, got ${response.status}: ${await response.text()}`)
}

function batchPayload(apiKey, ...events) {
  return {
    api_key: apiKey,
    batch: events
  }
}

function installDom(url) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url,
    pretendToBeVisual: true
  })
  const previous = new Map()
  const nativeFetch = globalThis.fetch.bind(globalThis)
  const browserFetch = (resource, init = {}) => {
    const requestUrl = typeof resource === 'string' || resource instanceof URL
      ? String(resource)
      : resource.url
    const headers = new Headers(init.headers ?? (typeof resource === 'object' && 'headers' in resource ? resource.headers : undefined))
    if (requestUrl.startsWith(serviceUrl) && !headers.has('origin')) {
      headers.set('origin', dom.window.location.origin)
    }
    return nativeFetch(resource, {
      ...init,
      headers
    })
  }
  const assignments = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    location: dom.window.location,
    history: dom.window.history,
    localStorage: dom.window.localStorage,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    Event: dom.window.Event,
    MouseEvent: dom.window.MouseEvent,
    Blob: dom.window.Blob,
    fetch: browserFetch,
    IntersectionObserver: undefined
  }

  for (const [key, value] of Object.entries(assignments)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true
    })
  }

  return {
    window: dom.window,
    restore() {
      dom.window.close()
      for (const [key, descriptor] of previous.entries()) {
        if (descriptor) {
          Object.defineProperty(globalThis, key, descriptor)
        } else {
          delete globalThis[key]
        }
      }
    }
  }
}

function assertCount(name, actual, expected, mode = 'minimum') {
  if (mode === 'exact') {
    assert(actual === expected, `Expected ${name} count to be ${expected}, got ${actual}`)
    return
  }
  assert(actual >= expected, `Expected ${name} count to be at least ${expected}, got ${actual}`)
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function identifier(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid ClickHouse identifier: ${value}`)
  }
  return value
}
