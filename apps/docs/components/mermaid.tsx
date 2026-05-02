'use client'

import mermaid from 'mermaid'
import { useTheme } from 'next-themes'
import { useEffect, useId, useRef, useState } from 'react'

type MermaidProps = {
  chart: string
}

export function Mermaid({ chart }: MermaidProps) {
  const id = useId()
  const { resolvedTheme } = useTheme()
  const renderCount = useRef(0)
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const elementId = `mermaid-${id.replace(/[^a-zA-Z0-9_-]/g, '')}-${renderCount.current++}`

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: resolvedTheme === 'dark' ? 'dark' : 'default'
    })

    mermaid
      .render(elementId, chart.replaceAll('\\n', '\n'))
      .then(({ svg }) => {
        if (!cancelled) {
          setSvg(svg)
          setError(null)
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setSvg(null)
          setError(reason instanceof Error ? reason.message : 'Unable to render Mermaid chart.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [chart, id, resolvedTheme])

  if (error) {
    return (
      <pre className="my-6 overflow-x-auto rounded-lg border bg-fd-card p-4 text-sm text-fd-muted-foreground">
        <code>{chart}</code>
      </pre>
    )
  }

  if (!svg) {
    return <div className="my-6 h-80 rounded-lg border bg-fd-card" aria-hidden="true" />
  }

  return (
    <div
      className="my-6 flex justify-center overflow-x-auto rounded-lg border bg-fd-card p-4"
      dangerouslySetInnerHTML={{
        __html: svg as string
      }}
    />
  )
}
