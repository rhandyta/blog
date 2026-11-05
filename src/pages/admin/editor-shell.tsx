import type { CategoryWithCount, SiteSettings, TagWithCount } from '../../lib/db/queries/taxonomy'
import type { Author, MediaAsset, User } from '../../lib/db/schema'
import type { EditorProps, EditorArticleState, AdminMediaSummary, MediaPageProps } from '../../lib/admin/types'
import { parseDoc } from '../../lib/content/doc'
import { AdminLayout } from '../../components/layout'
import { Flash } from './shared'

function serializeProps(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

export function mediaSummary(asset: MediaAsset): AdminMediaSummary {
  return {
    id: asset.id,
    src: asset.src,
    alt: asset.alt,
    caption: asset.caption,
    width: asset.width,
    height: asset.height,
    originalName: asset.originalName,
    createdAt: asset.createdAt,
  }
}

export function ArticleEditorPage({
  categories,
  authors,
  tags,
  media,
  csrfToken,
  article,
  previewToken,
  defaultAuthorId,
  origin,
}: {
  categories: CategoryWithCount[]
  authors: Author[]
  tags: TagWithCount[]
  media: MediaAsset[]
  csrfToken: string
  article: EditorArticleState | null
  previewToken: string | null
  defaultAuthorId: string | null
  origin: string
}) {
  const props: EditorProps = {
    article,
    categories: categories.map((category) => ({ id: category.id, name: category.name, accent: category.accent })),
    authors: authors.map((author) => ({ id: author.id, displayName: author.displayName })),
    tags: tags.map((tag) => ({ id: tag.id, name: tag.name })),
    media: media.map(mediaSummary),
    csrfToken,
    previewToken,
    defaultAuthorId,
    siteOrigin: origin,
  }

  return (
    <div className="editor-page">
      <div id="admin-root" data-mode="editor">
        <div style={{ padding: '2rem' }}>
          <a className="text-link" href="/admin/articles">← All articles</a>
          <p className="hint" style={{ marginTop: '1rem' }}>Loading the editor…</p>
          <noscript>
            <p className="flash" data-tone="error">The rich text editor requires JavaScript. The public site works without it.</p>
          </noscript>
        </div>
      </div>
      <script
        type="application/json"
        id="admin-props"
        dangerouslySetInnerHTML={{ __html: serializeProps(props) }}
      />
    </div>
  )
}

export function articleToEditorState(input: {
  article: {
    id: string
    title: string
    subtitle: string | null
    excerpt: string
    bodyJson: string
    slug: string
    status: 'draft' | 'scheduled' | 'published' | 'archived'
    categoryId: string | null
    authorId: string
    featuredMediaId: string | null
    featuredCaption: string | null
    ogMediaId: string | null
    isFeatured: boolean
    featuredRank: number | null
    isEditorsPick: boolean
    seoTitle: string | null
    seoDescription: string | null
    canonicalUrl: string | null
    noIndex: boolean
    publishedAt: string | null
    updatedAt: string | null
    scheduledFor: string | null
    isDemo: boolean
  }
  tags: string[]
}): EditorArticleState {
  return {
    id: input.article.id,
    title: input.article.title,
    subtitle: input.article.subtitle ?? '',
    excerpt: input.article.excerpt,
    body: parseDoc(input.article.bodyJson),
    slug: input.article.slug,
    status: input.article.status,
    categoryId: input.article.categoryId,
    authorId: input.article.authorId,
    featuredMediaId: input.article.featuredMediaId,
    featuredCaption: input.article.featuredCaption ?? '',
    ogMediaId: input.article.ogMediaId,
    isFeatured: input.article.isFeatured,
    featuredRank: input.article.featuredRank,
    isEditorsPick: input.article.isEditorsPick,
    seoTitle: input.article.seoTitle ?? '',
    seoDescription: input.article.seoDescription ?? '',
    canonicalUrl: input.article.canonicalUrl ?? '',
    noIndex: input.article.noIndex,
    publishedAt: input.article.publishedAt,
    updatedAt: input.article.updatedAt,
    scheduledFor: input.article.scheduledFor,
    tags: input.tags,
    isDemo: input.article.isDemo,
  }
}

export function MediaLibraryPage({
  user,
  settings,
  media,
  csrfToken,
  flash,
}: {
  user: User
  settings: SiteSettings
  media: MediaAsset[]
  csrfToken: string
  flash: Flash
}) {
  const props: MediaPageProps = {
    media: media.map(mediaSummary),
    csrfToken,
  }
  return (
    <AdminLayout
      user={user}
      path="/admin/media"
      title="Media"
      subtitle={`${media.length} assets · images are optimised on upload`}
      flash={flash}
      stats={{ drafts: 0, scheduled: 0 }}
      csrfToken={csrfToken}
    >
      <div id="admin-root" data-mode="media">
        <p className="hint">Loading media library…</p>
        <noscript>
          <p className="flash" data-tone="error">The media library requires JavaScript.</p>
        </noscript>
      </div>
      <script
        type="application/json"
        id="admin-props"
        dangerouslySetInnerHTML={{ __html: serializeProps(props) }}
      />
      <p className="hint" style={{ marginTop: '1rem' }}>
        Uploads are converted to WebP and AVIF at several widths, with a 1200×630 social crop. The media library is
        shared by everyone with editorial access.
      </p>
    </AdminLayout>
  )
}
