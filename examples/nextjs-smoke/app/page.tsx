'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAnalytics } from '@clickhouse-product-analytics/react'
import { apiHost } from './providers'

export default function Home() {
  const client = useAnalytics()
  const [status, setStatus] = useState('initializing')
  const runId = useMemo(() => `browser_${Date.now()}`, [])

  useEffect(() => {
    if (!client) {
      return
    }
    client.register({ example: 'nextjs-smoke', run_id: runId })
    setStatus('ready')
  }, [client, runId])

  const capture = async () => {
    client?.capture('example_button_clicked', {
      button: 'primary',
      run_id: runId,
      secret: 'not stored'
    })
    await client?.flush()
    setStatus('event sent')
  }

  const identify = async () => {
    client?.identify(`demo_${runId}`, {
      plan: 'developer',
      source: 'nextjs-smoke'
    })
    await client?.flush()
    setStatus('user identified')
  }

  return (
    <main>
      <section className="shell">
        <div>
          <p className="eyebrow">Local smoke app</p>
          <h1>ClickHouse Product Analytics</h1>
          <p className="lede">
            This page initializes the browser SDK, sends a pageview, captures button events,
            and identifies a user against the local ingest service.
          </p>
        </div>

        <div className="panel">
          <dl>
            <div>
              <dt>API host</dt>
              <dd>{apiHost}</dd>
            </div>
            <div>
              <dt>Run ID</dt>
              <dd>{runId}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{status}</dd>
            </div>
          </dl>

          <div className="actions">
            <button onClick={capture}>Capture Event</button>
            <button onClick={identify}>Identify User</button>
          </div>
        </div>
      </section>
    </main>
  )
}
