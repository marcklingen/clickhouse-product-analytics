import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/page'
import { APIPage } from '@/components/api-page'
import { getMDXComponents } from '@/mdx-components'
import { source } from '@/lib/source'

const githubEditLink = {
  owner: 'marcklingen',
  repo: 'clickhouse-product-analytics',
  sha: 'main'
}

type PageProps = {
  params: Promise<{
    slug?: string[]
  }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug = [] } = await params
  const page = source.getPage(slug)

  if (!page) {
    notFound()
  }

  return {
    title: page.data.title,
    description: page.data.description
  }
}

export default async function Page({ params }: PageProps) {
  const { slug = [] } = await params
  const page = source.getPage(slug)

  if (!page) {
    notFound()
  }

  const editOnGithub = page.absolutePath
    ? {
        ...githubEditLink,
        path: `content/docs/${page.path}`
      }
    : undefined

  if (page.data.type === 'openapi') {
    return (
      <DocsPage full toc={page.data.toc} editOnGithub={editOnGithub}>
        <DocsBody>
          <APIPage {...page.data.getAPIPageProps()} />
        </DocsBody>
      </DocsPage>
    )
  }

  const MDX = page.data.body

  return (
    <DocsPage toc={page.data.toc} editOnGithub={editOnGithub}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  )
}
