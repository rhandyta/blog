import type { Article } from '../../lib/db/schema'
import { formatDate } from '../../lib/content/html'

export type Flash = { tone: 'success' | 'error'; message: string } | null

export function CsrfField({ token }: { token: string }) {
  return <input type="hidden" name="_csrf" value={token} />
}

export function StatusPill({ status }: { status: Article['status'] }) {
  const label = status === 'scheduled' ? 'Scheduled' : status.charAt(0).toUpperCase() + status.slice(1)
  return <span className="status" data-status={status}>{label}</span>
}

export function UpdatedAt({ iso }: { iso: string }) {
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
    <nav className="paginator" aria-label="Pagination" style={{ marginTop: '1rem' }}>
      {page > 1 ? <a href={href(page - 1)} rel="prev">← Previous</a> : <span className="disabled">← Previous</span>}
      <span>Page {page} of {totalPages}</span>
      {page < totalPages ? <a href={href(page + 1)} rel="next">Next →</a> : <span className="disabled">Next →</span>}
    </nav>
  )
}
