import type { AdminAuditEntry, User } from '../../lib/db/schema'
import { useI18n } from '../../lib/i18n'
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
  const { t, formatDate } = useI18n()
  return (
    <AdminLayout
      user={user}
      path="/admin/audit"
      title={t('adminDashboard.audit.title')}
      subtitle={t('adminDashboard.audit.subtitle', { count: total })}
      csrfToken={csrfToken}
    >
      <p className="hint" style={{ marginBottom: '1rem' }}>
        {t('adminDashboard.audit.hint')}
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('adminDashboard.audit.colTime')}</th>
              <th>{t('adminDashboard.audit.colActor')}</th>
              <th>{t('adminDashboard.audit.colAction')}</th>
              <th>{t('adminDashboard.audit.colDetail')}</th>
              <th>{t('adminDashboard.audit.colIpHash')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(({ entry, actorName }) => (
              <tr key={entry.id}>
                <td className="muted-cell">{formatDate(entry.createdAt, 'long')}</td>
                <td className="muted-cell">{actorName ?? t('adminDashboard.audit.system')}</td>
                <td className="title-cell">{entry.action}</td>
                <td className="muted-cell">{entry.detail ?? '—'}</td>
                <td className="muted-cell">{entry.ipHash ? entry.ipHash.slice(0, 12) : '—'}</td>
              </tr>
            ))}
            {!entries.length ? (
              <tr>
                <td colSpan={5} className="hint" style={{ padding: '1.5rem' }}>
                  {t('adminDashboard.audit.empty')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <PaginationNav page={page} totalPages={totalPages} basePath="/admin/audit" />
    </AdminLayout>
  )
}
