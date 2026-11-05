import type { AdminFilters, CardRow } from '../../lib/db/queries/articles'
import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
import type { Article, Author, Category, User } from '../../lib/db/schema'
import { formatDate } from '../../lib/content/html'
import { AdminLayout } from '../../components/layout'
import { CsrfField, Flash, PaginationNav, StatusPill, UpdatedAt } from './shared'

export function DashboardPage({
  user,
  settings,
  stats,
  recent,
  scheduled,
  drafts,
  categories,
  subscriberCount,
  csrfToken,
}: {
  user: User
  settings: SiteSettings
  csrfToken: string
  stats: { total: number; published: number; drafts: number; scheduled: number; subscribers: number; media: number; weekViews: number }
  recent: CardRow[]
  scheduled: CardRow[]
  drafts: CardRow[]
  categories: CategoryWithCount[]
  subscriberCount: number
}) {
  return (
    <AdminLayout
      user={user}
      path="/admin"
      title="Overview"
      subtitle={`${settings.issue} · Editorial desk`}
      actions={<a className="btn btn--solid" href="/admin/articles/new">New article</a>}
      stats={{ drafts: stats.drafts, scheduled: stats.scheduled }}
      csrfToken={csrfToken}
    >
      <div className="admin-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{stats.published}</span>
            <span className="stat__label">Published pieces</span>
            <span className="stat__delta">{stats.total} total</span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{stats.drafts}</span>
            <span className="stat__label">Drafts in progress</span>
            <span className="stat__delta">{stats.scheduled} scheduled</span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{stats.subscribers}</span>
            <span className="stat__label">Subscribers</span>
            <span className="stat__delta">{subscriberCount} in the list</span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{stats.weekViews}</span>
            <span className="stat__label">Views this week</span>
            <span className="stat__delta">{stats.media} media assets</span>
          </div>
        </div>
      </div>

      <div className="admin-grid">
        <section className="admin-card" style={{ gridColumn: 'span 8' }}>
          <div className="admin-card__head">
            <h2>Recently updated</h2>
            <a className="text-link" href="/admin/articles">All articles →</a>
          </div>
          {recent.length ? (
            <div className="admin-table-wrap" style={{ border: 0 }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {recent.map(({ article }) => (
                    <tr key={article.id}>
                      <td className="title-cell"><a href={`/admin/articles/${article.id}/edit`}>{article.title}</a></td>
                      <td><StatusPill status={article.status} /></td>
                      <td><UpdatedAt iso={article.updatedAt} /></td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>
                        <a className="text-link" href={`/articles/${article.slug}`} target="_blank" rel="noopener">View</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="hint">No articles yet. <a className="text-link" href="/admin/articles/new">Write the first one →</a></p>
          )}
        </section>

        <aside className="admin-card" style={{ gridColumn: 'span 4' }}>
          <h2>Needs attention</h2>
          {drafts.length ? (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {drafts.slice(0, 5).map(({ article }) => (
                <li key={article.id}>
                  <a href={`/admin/articles/${article.id}/edit`} style={{ fontSize: '0.9rem', lineHeight: 1.4 }}>
                    {article.title}
                  </a>
                  <div className="meta" style={{ marginTop: '0.2rem' }}>Draft · {formatDate(article.updatedAt, 'short')}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">No drafts waiting.</p>
          )}

          <h2 style={{ marginTop: '1.75rem' }}>Scheduled</h2>
          {scheduled.length ? (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {scheduled.map(({ article }) => (
                <li key={article.id}>
                  <a href={`/admin/articles/${article.id}/edit`} style={{ fontSize: '0.9rem', lineHeight: 1.4 }}>{article.title}</a>
                  <div className="meta" style={{ marginTop: '0.2rem' }}>{formatDate(article.scheduledFor, 'short')}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">Nothing queued.</p>
          )}

          <h2 style={{ marginTop: '1.75rem' }}>Sections</h2>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {categories.map((category) => (
              <li key={category.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.85rem' }}>
                <a href={`/admin/articles?category=${category.id}`}>{category.name}</a>
                <span className="meta">{category.articleCount}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </AdminLayout>
  )
}

export function ArticleListPage({
  user,
  articles,
  total,
  page,
  totalPages,
  filters,
  categories,
  authors,
  session,
  flash,
}: {
  user: User
  articles: Array<{ article: Article; author: Author | null; category: Category | null }>
  total: number
  page: number
  totalPages: number
  filters: AdminFilters
  categories: CategoryWithCount[]
  authors: Author[]
  session: { csrfToken: string }
  flash: Flash
}) {
  const query = {
    status: filters.status && filters.status !== 'all' ? filters.status : undefined,
    category: filters.categoryId,
    author: filters.authorId,
    q: filters.q,
  }
  return (
    <AdminLayout
      user={user}
      path="/admin/articles"
      title="Articles"
      subtitle={`${total} pieces`}
      actions={<a className="btn btn--solid" href="/admin/articles/new">New article</a>}
      flash={flash}
      stats={{ drafts: 0, scheduled: 0 }}
      csrfToken={session.csrfToken}
    >
      <form className="filter-bar" method="get" action="/admin/articles">
        <div className="field">
          <label htmlFor="filter-q">Search</label>
          <input className="input" id="filter-q" name="q" defaultValue={filters.q ?? ''} placeholder="Title or slug" />
        </div>
        <div className="field">
          <label htmlFor="filter-status">Status</label>
          <select className="select" id="filter-status" name="status" defaultValue={filters.status ?? 'all'}>
            <option value="all">All</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-category">Section</label>
          <select className="select" id="filter-category" name="category" defaultValue={filters.categoryId ?? ''}>
            <option value="">All sections</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-author">Author</label>
          <select className="select" id="filter-author" name="author" defaultValue={filters.authorId ?? ''}>
            <option value="">All authors</option>
            {authors.map((author) => (
              <option key={author.id} value={author.id}>{author.displayName}</option>
            ))}
          </select>
        </div>
        <button className="btn btn--ghost btn--small" type="submit">Filter</button>
        <a className="text-link" href="/admin/articles" style={{ marginLeft: '0.25rem' }}>Reset</a>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Section</th>
              <th>Author</th>
              <th>Published</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {articles.map(({ article, author, category }) => (
              <tr key={article.id}>
                <td className="title-cell">
                  <a href={`/admin/articles/${article.id}/edit`}>{article.title}</a>
                  <div className="meta" style={{ marginTop: '0.2rem' }}>
                    {article.isFeatured ? 'Featured · ' : ''}{article.isEditorsPick ? 'Pick · ' : ''}/{article.slug}
                  </div>
                </td>
                <td><StatusPill status={article.status} /></td>
                <td className="muted-cell">{category?.name ?? '—'}</td>
                <td className="muted-cell">{author?.displayName ?? '—'}</td>
                <td className="muted-cell">{article.publishedAt ? formatDate(article.publishedAt, 'short') : '—'}</td>
                <td><UpdatedAt iso={article.updatedAt} /></td>
                <td>
                  <div className="actions">
                    <a className="btn btn--ghost btn--small" href={`/admin/articles/${article.id}/revisions`}>History</a>
                    <a className="btn btn--ghost btn--small" href={`/admin/articles/${article.id}/edit`}>Edit</a>
                    <form method="post" action={`/admin/articles/${article.id}/delete`} data-confirm="Delete this article? This cannot be undone.">
                      <CsrfField token={session.csrfToken} />
                      <button className="btn btn--danger btn--small" type="submit">Delete</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {!articles.length ? (
              <tr>
                <td colSpan={7} className="hint" style={{ padding: '1.5rem' }}>
                  No articles match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <PaginationNav page={page} totalPages={totalPages} basePath="/admin/articles" query={query} />
    </AdminLayout>
  )
}

export function RevisionsPage({
  user,
  article,
  revisions,
  session,
  flash,
}: {
  user: User
  article: Article
  revisions: Array<{ id: string; title: string; note: string | null; createdAt: string }>
  session: { csrfToken: string }
  flash: Flash
}) {
  return (
    <AdminLayout
      user={user}
      path="/admin/articles"
      title="Revision history"
      subtitle={article.title}
      actions={<a className="btn btn--ghost" href={`/admin/articles/${article.id}/edit`}>Back to editor</a>}
      flash={flash}
      csrfToken={session.csrfToken}
    >
      <p className="hint" style={{ marginBottom: '1rem' }}>
        A snapshot is stored each time the article is saved from the editor. The newest 30 revisions are kept.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Saved</th>
              <th>Title</th>
              <th>Note</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {revisions.map((revision) => (
              <tr key={revision.id}>
                <td className="muted-cell">{formatDate(revision.createdAt, 'long')}</td>
                <td className="title-cell">{revision.title}</td>
                <td className="muted-cell">{revision.note ?? '—'}</td>
                <td>
                  <form method="post" action={`/admin/articles/${article.id}/revisions/${revision.id}/restore`} data-confirm="Restore this revision? The current content will be saved as a new revision first.">
                    <CsrfField token={session.csrfToken} />
                    <button className="btn btn--ghost btn--small" type="submit">Restore</button>
                  </form>
                </td>
              </tr>
            ))}
            {!revisions.length ? (
              <tr><td colSpan={4} className="hint" style={{ padding: '1.5rem' }}>No revisions yet. Save the article from the editor to create one.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: '1.5rem' }}>
        <a className="text-link" href={`/articles/${article.slug}`} target="_blank" rel="noopener">View live article →</a>
      </p>
    </AdminLayout>
  )
}
