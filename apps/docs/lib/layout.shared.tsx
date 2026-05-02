import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'ClickHouse Product Analytics'
    },
    links: [
      {
        text: 'GitHub',
        url: 'https://github.com/marcklingen/clickhouse-product-analytics',
        external: true
      }
    ]
  }
}
