import type { AdminAuditEntry, User } from '../../lib/db/schema'
import { formatDate } from '../../lib/content/html'
import { AdminLayout } from '../../components/layout'
import { PaginationNav } from './shared'

export function AuditPage({
  user,
  entries,
  total,
  page,
  totalPages,
  csrfToken,
}: {
  user: User
  entries: Array<{ entry: AdminAuditEntry; actorName: string | null }>
  total: number
  page: number
  totalPages: number
  csrfToken: string
}) {
  return (
    <AdminLayout
      user={user}
      path="/admin/audit"
      title="Audit log"
      subtitle={`${total} recorded action${total === 1 ? '' : 's'}`}
      csrfToken={csrfToken}
    >
      <p className="hint" style={{ marginBottom: '1rem' }}>
        Administrative mutations are recorded with the actor, action, response status, and a hashed IP. This log is
        visible to administrators only.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Detail</th>
              <th>IP hash</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(({ entry, actorName }) => (
              <tr key={entry.id}>
                <td className="muted-cell">{formatDate(entry.createdAt, 'long')}</td>
                <td className="muted-cell">{actorName ?? 'System'}</td>
                <td className="title-cell">{entry.action}</td>
                <td className="muted-cell">{entry.detail ?? '—'}</td>
                <td className="muted-cell">{entry.ipHash ? entry.ipHash.slice(0, 12) : '—'}</td>
              </tr>
            ))}
            {!entries.length ? (
              <tr><td colSpan={5} className="hint" style={{ padding: '1.5rem' }}>No audit entries yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <PaginationNav page={page} totalPages={totalPages} basePath="/admin/audit" />
    </AdminLayout>
  )
}
