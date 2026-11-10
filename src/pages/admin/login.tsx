import type { SiteSettings } from '../../lib/db/queries/taxonomy'
import { useI18n } from '../../lib/i18n'
import { LanguageSwitcher } from '../../components/language-switcher'
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
  const { t } = useI18n()
  return (
    <main className="login-page">
      <section className="login-visual" aria-hidden="true">
        <div className="wordmark">
          <Fleuron size={22} />
          {settings.title}
        </div>
        <div className="login-visual__rule" />
        <p className="login-visual__headline">{t('admin.login.headline')}</p>
        <p className="login-visual__note">{t('admin.login.note', { issue: settings.issue })}</p>
        <div className="login-visual__num">01</div>
      </section>

      <section className="login-form-wrap">
        <form className="login-form" method="post" action="/admin/login">
          <div>
            <h1>{t('admin.login.signIn')}</h1>
            <p className="login-form__sub">{t('admin.login.desk')}</p>
          </div>
          <input type="hidden" name="_csrf" value={csrf} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {error ? (
            <div className="flash" data-tone="error" role="alert">
              {error}
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="email">{t('admin.login.email')}</label>
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
            <label htmlFor="password">{t('admin.login.password')}</label>
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
            {t('admin.login.submit')}
          </button>
          <p className="hint">{t('admin.login.hint')}</p>
        </form>
        <div className="login-form__lang">
          <LanguageSwitcher variant="admin" />
        </div>
      </section>
    </main>
  )
}
