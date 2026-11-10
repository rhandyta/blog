import type { UserSummary, UserSessionSummary } from '../../lib/db/queries/users'
import type { Author, User } from '../../lib/db/schema'
import { roleKey } from '../../lib/auth/permissions'
import { useI18n } from '../../lib/i18n'
import { AdminLayout } from '../../components/layout'
import { CsrfField, type Flash } from './shared'

export function AccountPage({
  user,
  linkedAuthor,
  sessions,
  currentSessionId,
  session,
  flash,
}: {
  user: User
  linkedAuthor: Author | null
  sessions: UserSessionSummary[]
  currentSessionId: string
  session: { csrfToken: string }
  flash: Flash
}) {
  const { t, formatDate } = useI18n()
  return (
    <AdminLayout
      user={user}
      path="/admin/account"
      title={t('adminSystem.account.title')}
      subtitle={t('adminSystem.account.subtitle', { email: user.email, role: t(roleKey(user.role)) })}
      flash={flash}
      csrfToken={session.csrfToken}
    >
      <div className="admin-grid">
        <section className="admin-card" style={{ gridColumn: 'span 6' }}>
          <h2>{t('adminSystem.account.profile')}</h2>
          <form method="post" action="/admin/account/profile" className="admin-form">
            <CsrfField token={session.csrfToken} />
            <div className="field">
              <label htmlFor="account-name">{t('adminSystem.account.displayName')}</label>
              <input className="input" id="account-name" name="name" defaultValue={user.name} required maxLength={80} />
            </div>
            <div className="field">
              <span className="label">{t('adminSystem.account.email')}</span>
              <p className="hint">{user.email}</p>
            </div>
            <div className="form-row">
              <div className="field">
                <span className="label">{t('adminSystem.account.role')}</span>
                <p className="hint">{t(roleKey(user.role))}</p>
              </div>
              <div className="field">
                <span className="label">{t('adminSystem.account.authorProfile')}</span>
                <p className="hint">
                  {linkedAuthor
                    ? `${linkedAuthor.displayName} (/${linkedAuthor.slug})`
                    : t('adminSystem.account.noneLinked')}
                </p>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">
                {t('adminSystem.account.saveProfile')}
              </button>
            </div>
          </form>
        </section>

        <section className="admin-card" style={{ gridColumn: 'span 6' }}>
          <h2>{t('adminSystem.account.changePassword')}</h2>
          <form method="post" action="/admin/account/password" className="admin-form">
            <CsrfField token={session.csrfToken} />
            <div className="field">
              <label htmlFor="currentPassword">{t('adminSystem.account.currentPassword')}</label>
              <input
                className="input"
                id="currentPassword"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="newPassword">{t('adminSystem.account.newPassword')}</label>
              <input
                className="input"
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={200}
                required
              />
              <p className="hint">{t('adminSystem.account.passwordHint')}</p>
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">{t('adminSystem.account.confirmNewPassword')}</label>
              <input
                className="input"
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={200}
                required
              />
            </div>
            <label className="checkbox">
              <input type="checkbox" name="revokeOthers" defaultChecked />
              <span>
                {t('adminSystem.account.signOutOthers')}
                <small>{t('adminSystem.account.signOutOthersHint')}</small>
              </span>
            </label>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">
                {t('adminSystem.account.updatePassword')}
              </button>
            </div>
          </form>
        </section>

        <section className="admin-card" style={{ gridColumn: '1 / -1' }}>
          <div className="admin-card__head">
            <h2>{t('adminSystem.account.activeSessions', { count: sessions.length })}</h2>
            {sessions.length > 1 ? (
              <form
                method="post"
                action="/admin/account/sessions/revoke-others"
                data-confirm={t('adminSystem.account.signOutOthersConfirm')}
              >
                <CsrfField token={session.csrfToken} />
                <button className="btn btn--ghost btn--small" type="submit">
                  {t('adminSystem.account.signOutOtherSessions')}
                </button>
              </form>
            ) : null}
          </div>
          <div className="admin-table-wrap" style={{ border: 0 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('adminSystem.account.session')}</th>
                  <th>{t('adminSystem.account.deviceBrowser')}</th>
                  <th>{t('adminSystem.account.created')}</th>
                  <th>{t('adminSystem.account.expires')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sessions.map((row) => {
                  const isCurrentSession = row.id === currentSessionId
                  return (
                    <tr key={row.id}>
                      <td>
                        <span className="status" data-status={isCurrentSession ? 'published' : 'draft'}>
                          {isCurrentSession ? t('adminSystem.account.current') : t('adminSystem.account.active')}
                        </span>
                      </td>
                      <td className="muted-cell" style={{ textTransform: 'none', maxWidth: '28rem' }}>
                        {row.userAgent ? row.userAgent.slice(0, 90) : t('adminSystem.account.unknownBrowser')}
                      </td>
                      <td className="muted-cell">{formatDate(row.createdAt, 'short')}</td>
                      <td className="muted-cell">{formatDate(row.expiresAt, 'short')}</td>
                      <td>
                        <div className="actions">
                          {isCurrentSession ? (
                            <span className="muted-cell">{t('adminSystem.account.thisBrowser')}</span>
                          ) : (
                            <form method="post" action={`/admin/account/sessions/${row.id}/revoke`}>
                              <CsrfField token={session.csrfToken} />
                              <button className="btn btn--danger btn--small" type="submit">
                                {t('adminSystem.account.revoke')}
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!sessions.length ? (
                  <tr>
                    <td colSpan={5} className="hint" style={{ padding: '1.25rem' }}>
                      {t('adminSystem.account.noSessions')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}

export function UsersPage({
  user,
  users,
  session,
  flash,
}: {
  user: User
  users: UserSummary[]
  session: { csrfToken: string }
  flash: Flash
}) {
  const { t, formatDate, href } = useI18n()
  const activeCount = users.filter((item) => item.active).length
  return (
    <AdminLayout
      user={user}
      path="/admin/users"
      title={t('adminSystem.users.title')}
      subtitle={t('adminSystem.users.subtitle', { total: users.length, active: activeCount })}
      flash={flash}
      csrfToken={session.csrfToken}
    >
      <div className="admin-grid">
        <section className="admin-card" style={{ gridColumn: 'span 8' }}>
          <div className="admin-table-wrap" style={{ border: 0 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('adminSystem.users.name')}</th>
                  <th>{t('adminSystem.users.role')}</th>
                  <th>{t('adminSystem.users.status')}</th>
                  <th className="num">{t('adminSystem.users.sessions')}</th>
                  <th>{t('adminSystem.users.lastLogin')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id}>
                    <td className="title-cell">
                      <a href={href(`/admin/users/${item.id}`)}>{item.name}</a>
                      {item.id === user.id ? (
                        <span className="muted-cell" style={{ marginLeft: '0.4rem' }}>
                          {t('adminSystem.users.you')}
                        </span>
                      ) : null}
                      <div className="meta" style={{ marginTop: '0.2rem' }}>
                        {item.email}
                        {item.authorSlug ? ` · /author/${item.authorSlug}` : ''}
                      </div>
                    </td>
                    <td className="muted-cell">{t(roleKey(item.role))}</td>
                    <td>
                      <span className="status" data-status={item.active ? 'published' : 'archived'}>
                        {item.active ? t('adminSystem.users.activeStatus') : t('adminSystem.users.disabledStatus')}
                      </span>
                    </td>
                    <td className="num">{item.sessionCount}</td>
                    <td className="muted-cell">
                      {item.lastLoginAt ? formatDate(item.lastLoginAt, 'short') : t('adminSystem.users.never')}
                    </td>
                    <td>
                      <a className="btn btn--ghost btn--small" href={href(`/admin/users/${item.id}`)}>
                        {t('adminSystem.users.edit')}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card" style={{ gridColumn: 'span 4' }}>
          <h2>{t('adminSystem.users.newUser')}</h2>
          <form method="post" action="/admin/users" className="admin-form">
            <CsrfField token={session.csrfToken} />
            <div className="field">
              <label htmlFor="new-user-name">{t('adminSystem.users.name')}</label>
              <input className="input" id="new-user-name" name="name" required maxLength={80} />
            </div>
            <div className="field">
              <label htmlFor="new-user-email">{t('adminSystem.users.email')}</label>
              <input className="input" id="new-user-email" name="email" type="email" required maxLength={200} />
            </div>
            <div className="field">
              <label htmlFor="new-user-password">{t('adminSystem.users.password')}</label>
              <input
                className="input"
                id="new-user-password"
                name="password"
                type="password"
                minLength={8}
                maxLength={200}
                required
              />
              <p className="hint">{t('adminSystem.users.passwordHint')}</p>
            </div>
            <div className="field">
              <label htmlFor="new-user-role">{t('adminSystem.users.role')}</label>
              <select className="select" id="new-user-role" name="role" defaultValue="author">
                <option value="author">{t('adminSystem.users.roleAuthor')}</option>
                <option value="editor">{t('adminSystem.users.roleEditor')}</option>
                <option value="admin">{t('adminSystem.users.roleAdmin')}</option>
              </select>
            </div>
            <label className="checkbox">
              <input type="checkbox" name="createAuthor" defaultChecked />
              <span>
                {t('adminSystem.users.createAuthorProfile')}
                <small>{t('adminSystem.users.createAuthorHint')}</small>
              </span>
            </label>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">
                {t('adminSystem.users.create')}
              </button>
            </div>
          </form>
        </section>
      </div>
    </AdminLayout>
  )
}

export function UserEditPage({
  user,
  target,
  authors,
  linkedAuthorId,
  sessions,
  session,
  flash,
}: {
  user: User
  target: User
  authors: Author[]
  linkedAuthorId: string | null
  sessions: UserSessionSummary[]
  session: { csrfToken: string }
  flash: Flash
}) {
  const { t, formatDate, href } = useI18n()
  const isSelf = target.id === user.id
  const assignableAuthors = authors.filter((author) => !author.userId || author.userId === target.id)

  return (
    <AdminLayout
      user={user}
      path="/admin/users"
      title={target.name}
      subtitle={t('adminSystem.userEdit.subtitle', {
        email: target.email,
        role: t(roleKey(target.role)),
      })}
      actions={
        <a className="btn btn--ghost" href={href('/admin/users')}>
          {t('adminSystem.userEdit.allUsers')}
        </a>
      }
      flash={flash}
      csrfToken={session.csrfToken}
    >
      <div className="admin-grid">
        <section className="admin-card" style={{ gridColumn: 'span 8' }}>
          <h2>{t('adminSystem.userEdit.accountDetails')}</h2>
          <form method="post" action={`/admin/users/${target.id}`} className="admin-form">
            <CsrfField token={session.csrfToken} />
            <div className="form-row">
              <div className="field">
                <label htmlFor="edit-user-name">{t('adminSystem.userEdit.name')}</label>
                <input
                  className="input"
                  id="edit-user-name"
                  name="name"
                  defaultValue={target.name}
                  required
                  maxLength={80}
                />
              </div>
              <div className="field">
                <label htmlFor="edit-user-email">{t('adminSystem.userEdit.email')}</label>
                <input
                  className="input"
                  id="edit-user-email"
                  name="email"
                  type="email"
                  defaultValue={target.email}
                  required
                  maxLength={200}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="edit-user-role">{t('adminSystem.userEdit.role')}</label>
                <select className="select" id="edit-user-role" name="role" defaultValue={target.role}>
                  <option value="author">{t(roleKey('author'))}</option>
                  <option value="editor">{t(roleKey('editor'))}</option>
                  <option value="admin">{t(roleKey('admin'))}</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="edit-user-author">{t('adminSystem.userEdit.linkedAuthor')}</label>
                <select className="select" id="edit-user-author" name="authorId" defaultValue={linkedAuthorId ?? ''}>
                  <option value="">{t('adminSystem.userEdit.noLinkedAuthor')}</option>
                  {assignableAuthors.map((author) => (
                    <option key={author.id} value={author.id}>
                      {author.displayName} (/{author.slug})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className="checkbox">
              <input type="checkbox" name="active" defaultChecked={target.active} />
              <span>
                {t('adminSystem.userEdit.activeAccount')}
                <small>
                  {isSelf ? t('adminSystem.userEdit.selfLockoutHint') : t('adminSystem.userEdit.disabledHint')}
                </small>
              </span>
            </label>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">
                {t('adminSystem.userEdit.save')}
              </button>
            </div>
          </form>
        </section>

        <aside style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <section className="admin-card">
            <h2>{t('adminSystem.userEdit.resetPassword')}</h2>
            <form method="post" action={`/admin/users/${target.id}/password`} className="admin-form">
              <CsrfField token={session.csrfToken} />
              <div className="field">
                <label htmlFor="reset-password">{t('adminSystem.userEdit.newPassword')}</label>
                <input
                  className="input"
                  id="reset-password"
                  name="newPassword"
                  type="password"
                  minLength={8}
                  maxLength={200}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="reset-confirm">{t('adminSystem.userEdit.confirmPassword')}</label>
                <input
                  className="input"
                  id="reset-confirm"
                  name="confirmPassword"
                  type="password"
                  minLength={8}
                  maxLength={200}
                  required
                />
              </div>
              <p className="hint">
                {isSelf ? t('adminSystem.userEdit.resetSelfHint') : t('adminSystem.userEdit.resetOtherHint')}
              </p>
              <div className="form-actions">
                <button className="btn btn--solid" type="submit">
                  {t('adminSystem.userEdit.setNewPassword')}
                </button>
              </div>
            </form>
          </section>

          <section className="admin-card">
            <h2>{t('adminSystem.userEdit.activeSessions', { count: sessions.length })}</h2>
            <p className="hint" style={{ marginBottom: '1rem' }}>
              {t('adminSystem.userEdit.sessionMeta', {
                created: formatDate(target.createdAt, 'short'),
                lastLogin: target.lastLoginAt
                  ? formatDate(target.lastLoginAt, 'short')
                  : t('adminSystem.userEdit.never'),
              })}
            </p>
            <form
              method="post"
              action={`/admin/users/${target.id}/revoke-sessions`}
              data-confirm={t('adminSystem.userEdit.revokeAllConfirm')}
            >
              <CsrfField token={session.csrfToken} />
              <button className="btn btn--danger" type="submit" disabled={sessions.length === 0}>
                {t('adminSystem.userEdit.revokeAll')}
              </button>
            </form>
          </section>
        </aside>
      </div>
    </AdminLayout>
  )
}
