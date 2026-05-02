'use client'

import { AnalyticsProvider } from '@clickhouse-product-analytics/react'
import type { ReactNode } from 'react'

const apiHost = process.env.NEXT_PUBLIC_CPA_HOST ?? 'http://127.0.0.1:8080'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AnalyticsProvider
      options={{
        apiHost,
        capturePageview: 'history_change',
        autocapture: {
          captureText: true,
          elementAllowlist: ['button', 'a']
        },
        flushIntervalMs: 1000,
        propertyDenylist: ['secret']
      }}
    >
      {children}
    </AnalyticsProvider>
  )
}

export { apiHost }
