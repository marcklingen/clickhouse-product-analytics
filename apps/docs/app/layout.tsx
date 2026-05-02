import './global.css'
import type { ReactNode } from 'react'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { source } from '@/lib/source'
import { baseOptions } from '@/lib/layout.shared'

const docsBasePath = process.env.NEXT_PUBLIC_DOCS_BASE_PATH ?? ''

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider
          search={{
            options: {
              api: `${docsBasePath}/api/search`,
              type: 'static'
            }
          }}
        >
          <DocsLayout tree={source.pageTree} {...baseOptions()}>
            {children}
          </DocsLayout>
        </RootProvider>
      </body>
    </html>
  )
}
