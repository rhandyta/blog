import type { UserSummary, UserSessionSummary } from '../../lib/db/queries/users'
import type { Author, User } from '../../lib/db/schema'
import { roleLabel } from '../../lib/auth/permissions'
import { formatDate } from '../../lib/content/html'
import { AdminLayout } from '../../components/layout'
import { CsrfField, Flash } from './shared'

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
  return (
    <AdminLayout
      user={user}
      path="/admin/account"
      title="Account"
      subtitle={`${user.email} · ${roleLabel(user.role)}`}
      flash={flash}
      csrfToken={session.csrfToken}
    >
      <div className="admin-grid">
        <section className="admin-card" style={{ gridColumn: 'span 6' }}>
          <h2>Profile</h2>
          <form method="post" action="/admin/account/profile" className="admin-form">
            <CsrfField token={session.csrfToken} />
            <div className="field">
              <label htmlFor="account-name">Display name</label>
              <input
                className="input"
                id="account-name"
                name="name"
                defaultValue={user.name}
                required
                maxLength={80}
              />
            </div>
            <div className="field">
              <label>Email</label>
              <p className="hint">{user.email}</p>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Role</label>
                <p className="hint">{roleLabel(user.role)}</p>
              </div>
              <div className="field">
                <label>Author profile</label>
                <p className="hint">
                  {linkedAuthor ? `${linkedAuthor.displayName} (/${linkedAuthor.slug})` : 'None linked'}
                </p>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">Save profile</button>
            </div>
          </form>
        </section>

        <section className="admin-card" style={{ gridColumn: 'span 6' }}>
          <h2>Change password</h2>
          <form method="post" action="/admin/account/password" className="admin-form">
            <CsrfField token={session.csrfToken} />
            <div className="field">
              <label htmlFor="currentPassword">Current password</label>
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
              <label htmlFor="newPassword">New password</label>
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
              <p className="hint">Use at least 8 characters.</p>
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">Confirm new password</label>
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
                Sign out other active sessions
                <small>Keeps this browser signed in and ends all other sessions.</small>
              </span>
            </label>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">Update password</button>
            </div>
          </form>
        </section>

        <section className="admin-card" style={{ gridColumn: '1 / -1' }}>
          <div className="admin-card__head">
            <h2>Active sessions ({sessions.length})</h2>
            {sessions.length > 1 ? (
              <form
                method="post"
                action="/admin/account/sessions/revoke-others"
                data-confirm="Sign out all other active sessions?"
              >
                <CsrfField token={session.csrfToken} />
                <button className="btn btn--ghost btn--small" type="submit">Sign out other sessions</button>
              </form>
            ) : null}
          </div>
          <div className="admin-table-wrap" style={{ border: 0 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Device / Browser</th>
                  <th>Created</th>
                  <th>Expires</th>
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
                          {isCurrentSession ? 'Current' : 'Active'}
                        </span>
                      </td>
                      <td className="muted-cell" style={{ textTransform: 'none', maxWidth: '28rem' }}>
                        {row.userAgent ? row.userAgent.slice(0, 90) : 'Unknown browser'}
                      </td>
                      <td className="muted-cell">{formatDate(row.createdAt, 'short')}</td>
                      <td className="muted-cell">{formatDate(row.expiresAt, 'short')}</td>
                      <td>
                        <div className="actions">
                          {isCurrentSession ? (
                            <span className="muted-cell">This browser</span>
                          ) : (
                            <form method="post" action={`/admin/account/sessions/${row.id}/revoke`}>
                              <CsrfField token={session.csrfToken} />
                              <button className="btn btn--danger btn--small" type="submit">Revoke</button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!sessions.length ? (
                  <tr>
                    <td colSpan={5} className="hint" style={{ padding: '1.25rem' }}>No active sessions found.</td>
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
  const activeCount = users.filter((item) => item.active).length
  return (
    <AdminLayout
      user={user}
      path="/admin/users"
      title="Users"
      subtitle={`${users.length} accounts · ${activeCount} active`}
      flash={flash}
      csrfToken={session.csrfToken}
    >
      <div className="admin-grid">
        <section className="admin-card" style={{ gridColumn: 'span 8' }}>
          <div className="admin-table-wrap" style={{ border: 0 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th className="num">Sessions</th>
                  <th>Last login</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id}>
                    <td className="title-cell">
                      <a href={`/admin/users/${item.id}`}>{item.name}</a>
                      {item.id === user.id ? <span className="muted-cell" style={{ marginLeft: '0.4rem' }}>(you)</span> : null}
                      <div className="meta" style={{ marginTop: '0.2rem' }}>
                        {item.email}
                        {item.authorSlug ? ` · /author/${item.authorSlug}` : ''}
                      </div>
                    </td>
                    <td className="muted-cell">{roleLabel(item.role)}</td>
                    <td>
                      <span className="status" data-status={item.active ? 'published' : 'archived'}>
                        {item.active ? 'active' : 'disabled'}
                      </span>
                    </td>
                    <td className="num">{item.sessionCount}</td>
                    <td className="muted-cell">{item.lastLoginAt ? formatDate(item.lastLoginAt, 'short') : 'Never'}</td>
                    <td>
                      <a className="btn btn--ghost btn--small" href={`/admin/users/${item.id}`}>Edit</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card" style={{ gridColumn: 'span 4' }}>
          <h2>New user</h2>
          <form method="post" action="/admin/users" className="admin-form">
            <CsrfField token={session.csrfToken} />
            <div className="field">
              <label htmlFor="new-user-name">Name</label>
              <input className="input" id="new-user-name" name="name" required maxLength={80} />
            </div>
            <div className="field">
              <label htmlFor="new-user-email">Email</label>
              <input className="input" id="new-user-email" name="email" type="email" required maxLength={200} />
            </div>
            <div className="field">
              <label htmlFor="new-user-password">Password</label>
              <input
                className="input"
                id="new-user-password"
                name="password"
                type="password"
                minLength={8}
                maxLength={200}
                required
              />
              <p className="hint">At least 8 characters.</p>
            </div>
            <div className="field">
              <label htmlFor="new-user-role">Role</label>
              <select className="select" id="new-user-role" name="role" defaultValue="author">
                <option value="author">Author — own articles &amp; own uploads</option>
                <option value="editor">Editor — editorial desk, analytics &amp; settings</option>
                <option value="admin">Administrator — full desk &amp; user management</option>
              </select>
            </div>
            <label className="checkbox">
              <input type="checkbox" name="createAuthor" defaultChecked />
              <span>
                Create matching public author profile
                <small>Allows Author accounts to draft and save articles right away.</small>
              </span>
            </label>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">Create user</button>
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
  const isSelf = target.id === user.id
  const assignableAuthors = authors.filter((author) => !author.userId || author.userId === target.id)

  return (
    <AdminLayout
      user={user}
      path="/admin/users"
      title={target.name}
      subtitle={`${target.email} · ${roleLabel(target.role)}`}
      actions={<a className="btn btn--ghost" href="/admin/users">← All users</a>}
      flash={flash}
      csrfToken={session.csrfToken}
    >
      <div className="admin-grid">
        <section className="admin-card" style={{ gridColumn: 'span 8' }}>
          <h2>Account details</h2>
          <form method="post" action={`/admin/users/${target.id}`} className="admin-form">
            <CsrfField token={session.csrfToken} />
            <div className="form-row">
              <div className="field">
                <label htmlFor="edit-user-name">Name</label>
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
                <label htmlFor="edit-user-email">Email</label>
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
                <label htmlFor="edit-user-role">Role</label>
                <select className="select" id="edit-user-role" name="role" defaultValue={target.role}>
                  <option value="author">Author</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="edit-user-author">Linked author profile</label>
                <select
                  className="select"
                  id="edit-user-author"
                  name="authorId"
                  defaultValue={linkedAuthorId ?? ''}
                >
                  <option value="">No linked author profile</option>
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
                Active account
                <small>
                  {isSelf
                    ? 'You cannot disable or demote your own administrator account.'
                    : 'Disabled accounts are signed out immediately and cannot log in.'}
                </small>
              </span>
            </label>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">Save user</button>
            </div>
          </form>
        </section>

        <aside style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <section className="admin-card">
            <h2>Reset password</h2>
            <form method="post" action={`/admin/users/${target.id}/password`} className="admin-form">
              <CsrfField token={session.csrfToken} />
              <div className="field">
                <label htmlFor="reset-password">New password</label>
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
                <label htmlFor="reset-confirm">Confirm password</label>
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
                {isSelf
                  ? 'Ends other active sessions on password reset.'
                  : 'Immediately signs out all active sessions for this user.'}
              </p>
              <div className="form-actions">
                <button className="btn btn--solid" type="submit">Set new password</button>
              </div>
            </form>
          </section>

          <section className="admin-card">
            <h2>Active sessions ({sessions.length})</h2>
            <p className="hint" style={{ marginBottom: '1rem' }}>
              Created {formatDate(target.createdAt, 'short')} · Last login{' '}
              {target.lastLoginAt ? formatDate(target.lastLoginAt, 'short') : 'never'}.
            </p>
            <form
              method="post"
              action={`/admin/users/${target.id}/revoke-sessions`}
              data-confirm="Sign out all active sessions for this user?"
            >
              <CsrfField token={session.csrfToken} />
              <button className="btn btn--danger" type="submit" disabled={sessions.length === 0}>
                Revoke all sessions
              </button>
            </form>
          </section>
        </aside>
      </div>
    </AdminLayout>
  )
}
