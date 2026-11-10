import type { AdminFilters, ArticleAudience, CardRow } from '../../lib/db/queries/articles'
import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
import type { Article, Author, Category, User } from '../../lib/db/schema'
import { useI18n } from '../../lib/i18n'
import { AdminLayout } from '../../components/layout'
import { CsrfField, type Flash, PaginationNav, StatusPill, UpdatedAt } from './shared'

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
  stats: {
    total: number
    published: number
    drafts: number
    scheduled: number
    subscribers: number
    media: number
    weekViews: number
    weekReaders: number
  }
  recent: CardRow[]
  scheduled: CardRow[]
  drafts: CardRow[]
  categories: CategoryWithCount[]
  subscriberCount: number
}) {
  const { t, formatDate } = useI18n()
  return (
    <AdminLayout
      user={user}
      path="/admin"
      title={t('adminDashboard.dashboard.title')}
      subtitle={t('adminDashboard.dashboard.subtitle', { issue: settings.issue })}
      actions={
        <>
          {user.role !== 'author' ? (
            <a className="btn btn--ghost" href="/admin/analytics">
              {t('adminDashboard.dashboard.audience')} →
            </a>
          ) : null}
          <a className="btn btn--solid" href="/admin/articles/new">
            {t('adminDashboard.dashboard.newArticle')}
          </a>
        </>
      }
      stats={{ drafts: stats.drafts, scheduled: stats.scheduled }}
      csrfToken={csrfToken}
    >
      <div className="admin-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{stats.published}</span>
            <span className="stat__label">{t('adminDashboard.dashboard.publishedPieces')}</span>
            <span className="stat__delta">{t('adminDashboard.dashboard.total', { count: stats.total })}</span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{stats.drafts}</span>
            <span className="stat__label">{t('adminDashboard.dashboard.draftsInProgress')}</span>
            <span className="stat__delta">
              {t('adminDashboard.dashboard.scheduledCount', { count: stats.scheduled })}
            </span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{stats.subscribers}</span>
            <span className="stat__label">{t('adminDashboard.dashboard.subscribers')}</span>
            <span className="stat__delta">{t('adminDashboard.dashboard.inTheList', { count: subscriberCount })}</span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{stats.weekReaders}</span>
            <span className="stat__label">{t('adminDashboard.dashboard.readersThisWeek')}</span>
            <span className="stat__delta">
              {t('adminDashboard.dashboard.viewsThisWeek', { count: stats.weekViews })}
            </span>
          </div>
        </div>
      </div>

      <div className="admin-grid">
        <section className="admin-card" style={{ gridColumn: 'span 8' }}>
          <div className="admin-card__head">
            <h2>{t('adminDashboard.dashboard.recentlyUpdated')}</h2>
            <a className="text-link" href="/admin/articles">
              {t('adminDashboard.dashboard.allArticles')} →
            </a>
          </div>
          {recent.length ? (
            <div className="admin-table-wrap" style={{ border: 0 }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t('adminDashboard.dashboard.colTitle')}</th>
                    <th>{t('adminDashboard.dashboard.colStatus')}</th>
                    <th>{t('adminDashboard.dashboard.colUpdated')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {recent.map(({ article }) => (
                    <tr key={article.id}>
                      <td className="title-cell">
                        <a href={`/admin/articles/${article.id}/edit`}>{article.title}</a>
                      </td>
                      <td>
                        <StatusPill status={article.status} />
                      </td>
                      <td>
                        <UpdatedAt iso={article.updatedAt} />
                      </td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>
                        <a className="text-link" href={`/articles/${article.slug}`} target="_blank" rel="noopener">
                          {t('adminDashboard.dashboard.view')}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="hint">
              {t('adminDashboard.dashboard.emptyArticles')}{' '}
              <a className="text-link" href="/admin/articles/new">
                {t('adminDashboard.dashboard.writeFirst')} →
              </a>
            </p>
          )}
        </section>

        <aside className="admin-card" style={{ gridColumn: 'span 4' }}>
          <h2>{t('adminDashboard.dashboard.needsAttention')}</h2>
          {drafts.length ? (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {drafts.slice(0, 5).map(({ article }) => (
                <li key={article.id}>
                  <a href={`/admin/articles/${article.id}/edit`} style={{ fontSize: '0.9rem', lineHeight: 1.4 }}>
                    {article.title}
                  </a>
                  <div className="meta" style={{ marginTop: '0.2rem' }}>
                    {t('adminDashboard.dashboard.draftLabel')} · {formatDate(article.updatedAt, 'short')}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">{t('adminDashboard.dashboard.noDrafts')}</p>
          )}

          <h2 style={{ marginTop: '1.75rem' }}>{t('adminDashboard.dashboard.scheduled')}</h2>
          {scheduled.length ? (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {scheduled.map(({ article }) => (
                <li key={article.id}>
                  <a href={`/admin/articles/${article.id}/edit`} style={{ fontSize: '0.9rem', lineHeight: 1.4 }}>
                    {article.title}
                  </a>
                  <div className="meta" style={{ marginTop: '0.2rem' }}>
                    {formatDate(article.scheduledFor, 'short')}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">{t('adminDashboard.dashboard.nothingQueued')}</p>
          )}

          <h2 style={{ marginTop: '1.75rem' }}>{t('adminDashboard.dashboard.sections')}</h2>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {categories.map((category) => (
              <li
                key={category.id}
                style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.85rem' }}
              >
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
  articles: Array<{ article: Article; author: Author | null; category: Category | null; audience: ArticleAudience }>
  total: number
  page: number
  totalPages: number
  filters: AdminFilters
  categories: CategoryWithCount[]
  authors: Author[]
  session: { csrfToken: string }
  flash: Flash
}) {
  const { t, formatDate, formatNumber } = useI18n()
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
      title={t('adminDashboard.articles.title')}
      subtitle={t('adminDashboard.articles.subtitle', { count: total })}
      actions={
        <a className="btn btn--solid" href="/admin/articles/new">
          {t('adminDashboard.articles.newArticle')}
        </a>
      }
      flash={flash}
      csrfToken={session.csrfToken}
    >
      <form className="filter-bar" method="get" action="/admin/articles">
        <div className="field">
          <label htmlFor="filter-q">{t('adminDashboard.articles.search')}</label>
          <input
            className="input"
            id="filter-q"
            name="q"
            defaultValue={filters.q ?? ''}
            placeholder={t('adminDashboard.articles.searchPlaceholder')}
          />
        </div>
        <div className="field">
          <label htmlFor="filter-status">{t('adminDashboard.articles.status')}</label>
          <select className="select" id="filter-status" name="status" defaultValue={filters.status ?? 'all'}>
            <option value="all">{t('adminDashboard.articles.statusAll')}</option>
            <option value="published">{t('adminDashboard.articles.statusPublished')}</option>
            <option value="draft">{t('adminDashboard.articles.statusDraft')}</option>
            <option value="scheduled">{t('adminDashboard.articles.statusScheduled')}</option>
            <option value="archived">{t('adminDashboard.articles.statusArchived')}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-category">{t('adminDashboard.articles.section')}</label>
          <select className="select" id="filter-category" name="category" defaultValue={filters.categoryId ?? ''}>
            <option value="">{t('adminDashboard.articles.allSections')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-author">{t('adminDashboard.articles.author')}</label>
          <select className="select" id="filter-author" name="author" defaultValue={filters.authorId ?? ''}>
            <option value="">{t('adminDashboard.articles.allAuthors')}</option>
            {authors.map((author) => (
              <option key={author.id} value={author.id}>
                {author.displayName}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn--ghost btn--small" type="submit">
          {t('adminDashboard.articles.filter')}
        </button>
        <a className="text-link" href="/admin/articles" style={{ marginLeft: '0.25rem' }}>
          {t('adminDashboard.articles.reset')}
        </a>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('adminDashboard.articles.colTitle')}</th>
              <th>{t('adminDashboard.articles.colStatus')}</th>
              <th className="num">{t('adminDashboard.articles.colReaders')}</th>
              <th className="num">{t('adminDashboard.articles.colViews')}</th>
              <th>{t('adminDashboard.articles.colSection')}</th>
              <th>{t('adminDashboard.articles.colAuthor')}</th>
              <th>{t('adminDashboard.articles.colPublished')}</th>
              <th>{t('adminDashboard.articles.colUpdated')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {articles.map(({ article, author, category, audience }) => (
              <tr key={article.id}>
                <td className="title-cell">
                  <a href={`/admin/articles/${article.id}/edit`}>{article.title}</a>
                  <div className="meta" style={{ marginTop: '0.2rem' }}>
                    {article.isFeatured ? `${t('adminDashboard.articles.featured')} · ` : ''}
                    {article.isEditorsPick ? `${t('adminDashboard.articles.pick')} · ` : ''}/{article.slug}
                  </div>
                </td>
                <td>
                  <StatusPill status={article.status} />
                </td>
                <td className="num">{formatNumber(audience.readers)}</td>
                <td className="num">{formatNumber(audience.views)}</td>
                <td className="muted-cell">{category?.name ?? '—'}</td>
                <td className="muted-cell">{author?.displayName ?? '—'}</td>
                <td className="muted-cell">{article.publishedAt ? formatDate(article.publishedAt, 'short') : '—'}</td>
                <td>
                  <UpdatedAt iso={article.updatedAt} />
                </td>
                <td>
                  <div className="actions">
                    <a className="btn btn--ghost btn--small" href={`/admin/articles/${article.id}/revisions`}>
                      {t('adminDashboard.articles.history')}
                    </a>
                    <a className="btn btn--ghost btn--small" href={`/admin/articles/${article.id}/export.md`}>
                      .md
                    </a>
                    <a className="btn btn--ghost btn--small" href={`/admin/articles/${article.id}/edit`}>
                      {t('adminDashboard.articles.edit')}
                    </a>
                    <form
                      method="post"
                      action={`/admin/articles/${article.id}/delete`}
                      data-confirm={t('adminDashboard.articles.deleteConfirm')}
                    >
                      <CsrfField token={session.csrfToken} />
                      <button className="btn btn--danger btn--small" type="submit">
                        {t('adminDashboard.articles.delete')}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {!articles.length ? (
              <tr>
                <td colSpan={9} className="hint" style={{ padding: '1.5rem' }}>
                  {t('adminDashboard.articles.empty')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="hint" style={{ marginTop: '0.75rem' }}>
        {t('adminDashboard.articles.readerHint')}
      </p>

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
  const { t, formatDate } = useI18n()
  return (
    <AdminLayout
      user={user}
      path="/admin/articles"
      title={t('adminDashboard.revisions.title')}
      subtitle={article.title}
      actions={
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <a className="btn btn--ghost" href={`/admin/articles/${article.id}/export.md`}>
            {t('adminDashboard.revisions.export')}
          </a>
          <a className="btn btn--ghost" href={`/admin/articles/${article.id}/edit`}>
            {t('adminDashboard.revisions.backToEditor')}
          </a>
        </div>
      }
      flash={flash}
      csrfToken={session.csrfToken}
    >
      <p className="hint" style={{ marginBottom: '1rem' }}>
        {t('adminDashboard.revisions.hint')}
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('adminDashboard.revisions.colSaved')}</th>
              <th>{t('adminDashboard.revisions.colTitle')}</th>
              <th>{t('adminDashboard.revisions.colNote')}</th>
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
                  <form
                    method="post"
                    action={`/admin/articles/${article.id}/revisions/${revision.id}/restore`}
                    data-confirm={t('adminDashboard.revisions.restoreConfirm')}
                  >
                    <CsrfField token={session.csrfToken} />
                    <button className="btn btn--ghost btn--small" type="submit">
                      {t('adminDashboard.revisions.restore')}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {!revisions.length ? (
              <tr>
                <td colSpan={4} className="hint" style={{ padding: '1.5rem' }}>
                  {t('adminDashboard.revisions.empty')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: '1.5rem' }}>
        <a className="text-link" href={`/articles/${article.slug}`} target="_blank" rel="noopener">
          {t('adminDashboard.revisions.viewLive')} →
        </a>
      </p>
    </AdminLayout>
  )
}
