import type { PMDoc } from '../content/doc'

export type AdminMediaSummary = {
  id: string
  src: string
  alt: string
  caption: string | null
  width: number
  height: number
  originalName?: string
  createdAt?: string
}

export type EditorArticleState = {
  id: string
  title: string
  subtitle: string
  excerpt: string
  body: PMDoc
  slug: string
  status: 'draft' | 'scheduled' | 'published' | 'archived'
  categoryId: string | null
  authorId: string
  featuredMediaId: string | null
  featuredCaption: string
  ogMediaId: string | null
  isFeatured: boolean
  featuredRank: number | null
  isEditorsPick: boolean
  seoTitle: string
  seoDescription: string
  canonicalUrl: string
  noIndex: boolean
  publishedAt: string | null
  updatedAt: string | null
  scheduledFor: string | null
  tags: string[]
  isDemo: boolean
}

export type EditorProps = {
  article: EditorArticleState | null
  categories: Array<{ id: string; name: string; accent: string }>
  authors: Array<{ id: string; displayName: string }>
  tags: Array<{ id: string; name: string }>
  media: AdminMediaSummary[]
  csrfToken: string
  previewToken: string | null
  defaultAuthorId: string | null
  siteOrigin: string
}

export type MediaPageProps = {
  media: AdminMediaSummary[]
  csrfToken: string
}
