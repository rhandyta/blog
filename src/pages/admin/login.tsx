import type { SiteSettings } from '../../lib/db/queries/taxonomy'
import { Fleuron } from '../../components/ui'

export function LoginPage({
  settings,
  csrf,
  email,
  error,
  next,
}: {
  settings: SiteSettings
  csrf: string
  email?: string
  error?: string | null
  next?: string
}) {
  return (
    <main className="login-page">
      <section className="login-visual" aria-hidden="true">
        <div className="wordmark">
          <Fleuron size={22} />
          {settings.title}
        </div>
        <div className="login-visual__rule" />
        <p className="login-visual__headline">The desk behind the publication.</p>
        <p className="login-visual__note">Editorial access · {settings.issue}</p>
        <div className="login-visual__num">01</div>
      </section>

      <section className="login-form-wrap">
        <form className="login-form" method="post" action="/admin/login">
          <div>
            <h1>Sign in</h1>
            <p className="login-form__sub">Editorial desk</p>
          </div>
          <input type="hidden" name="_csrf" value={csrf} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {error ? (
            <div className="flash" data-tone="error" role="alert">
              {error}
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              className="input"
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              defaultValue={email}
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <button className="btn btn--solid" type="submit" style={{ width: '100%' }}>
            Enter the desk
          </button>
          <p className="hint">
            Demonstration credentials are documented in the project README. Sessions are stored server-side and expire
            after 30 days.
          </p>
        </form>
      </section>
    </main>
  )
}
