import type { Article } from '../../lib/db/schema'
import { useI18n } from '../../lib/i18n'
import { articleStatusKey } from '../../lib/i18n/status'

export type Flash = { tone: 'success' | 'error'; message: string } | null

export function CsrfField({ token }: { token: string }) {
  return <input type="hidden" name="_csrf" value={token} />
}

export function StatusPill({ status }: { status: Article['status'] }) {
  const { t } = useI18n()
  return (
    <span className="status" data-status={status}>
      {t(articleStatusKey(status))}
    </span>
  )
}

export function UpdatedAt({ iso }: { iso: string }) {
  const { formatDate } = useI18n()
  return <span className="muted-cell">{formatDate(iso, 'short')}</span>
}

export function ErrorList({ errors }: { errors: string[] }) {
  if (!errors.length) return null
  return (
    <div className="flash" data-tone="error" role="alert">
      {errors.map((error) => (
        <div key={error}>{error}</div>
      ))}
    </div>
  )
}

export function PaginationNav({
  page,
  totalPages,
  basePath,
  query,
}: {
  page: number
  totalPages: number
  basePath: string
  query?: Record<string, string | undefined>
}) {
  const { t } = useI18n()
  if (totalPages <= 1) return null
  const href = (target: number) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value) params.set(key, value)
    }
    if (target > 1) params.set('page', String(target))
    const search = params.toString()
    return search ? `${basePath}?${search}` : basePath
  }
  return (
    <nav className="paginator" aria-label={t('admin.paginationLabel')} style={{ marginTop: '1rem' }}>
      {page > 1 ? (
        <a href={href(page - 1)} rel="prev">
          ← {t('admin.previous')}
        </a>
      ) : (
        <span className="disabled">← {t('admin.previous')}</span>
      )}
      <span>{t('admin.pageOf', { page, total: totalPages })}</span>
      {page < totalPages ? (
        <a href={href(page + 1)} rel="next">
          {t('admin.next')} →
        </a>
      ) : (
        <span className="disabled">{t('admin.next')} →</span>
      )}
    </nav>
  )
}
