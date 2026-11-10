import { createContext, useContext, type ReactNode } from 'react'
import type { SiteSettings, CategoryWithCount } from '../lib/db/queries/taxonomy'
import type { User } from '../lib/db/schema'
import { roleKey } from '../lib/auth/permissions'
import { useI18n } from '../lib/i18n'
import { buildClientMessages } from '../lib/i18n/client'
import { LanguageSwitcher } from './language-switcher'
import { ClientI18n } from './client-i18n'
import { Fleuron, accentClass } from './ui'

function isCurrent(path: string, href: string): boolean {
  if (href === '/') return path === '/'
  return path === href || path.startsWith(`${href}/`)
}

export function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" focusable="false">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M12.8 12.8 17 17" strokeLinecap="round" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg
      className="icon-sun"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="10" cy="10" r="3.4" />
      <path
        d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M15.7 4.3l-1.4 1.4M5.7 14.3l-1.4 1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      className="icon-moon"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M16.5 12.4A7 7 0 0 1 7.6 3.5a7 7 0 1 0 8.9 8.9Z" strokeLinejoin="round" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
    >
      <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
    </svg>
  )
}

export function ThemeToggle() {
  const { t } = useI18n()
  return (
    <button className="icon-button theme-toggle" type="button" data-theme-toggle aria-label={t('header.themeToggle')}>
      <SunIcon />
      <MoonIcon />
    </button>
  )
}

export function SiteHeader({
  settings,
  categories,
  path,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  path: string
}) {
  const { t, href, formatDate } = useI18n()
  const today = formatDate(new Date(), 'weekday')

  return (
    <header className="site-header">
      <div className="utility-bar">
        <div className="shell">
          <span>
            {settings.issue} — {settings.tagline}
          </span>
          <div className="utility-bar__links">
            <span>{today}</span>
            <a href={href('/archive')}>{t('nav.archive')}</a>
            <a href={href('/saved')} className="saved-link" aria-label={t('header.savedLabel')}>
              {t('nav.saved')} <span className="saved-count" data-saved-count></span>
            </a>
            <LanguageSwitcher />
            <ThemeToggle />
            <a href={href('/search')} className="icon-button" aria-label={t('header.searchLabel')}>
              <SearchIcon />
            </a>
          </div>
        </div>
      </div>

      <div className="shell masthead">
        <a href={href('/')} className="wordmark" aria-label={t('header.homeLink', { site: settings.title })}>
          <Fleuron size={19} />
          {settings.title}
        </a>
        <nav className="primary-nav" aria-label={t('nav.primary')}>
          <a href={href('/articles')} aria-current={isCurrent(path, '/articles') ? 'page' : undefined}>
            {t('nav.articles')}
          </a>
          <a href={href('/topics')} aria-current={isCurrent(path, '/topics') ? 'page' : undefined}>
            {t('nav.topics')}
          </a>
          <a href={href('/archive')} aria-current={isCurrent(path, '/archive') ? 'page' : undefined}>
            {t('nav.archive')}
          </a>
          <a href={href('/about')} aria-current={isCurrent(path, '/about') ? 'page' : undefined}>
            {t('nav.about')}
          </a>
        </nav>
        <button
          className="icon-button menu-toggle"
          type="button"
          data-menu-open
          aria-expanded="false"
          aria-controls="mobile-menu"
          aria-label={t('nav.openMenu')}
        >
          <MenuIcon />
        </button>
      </div>

      <div
        className="mobile-menu"
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.menu')}
        tabIndex={-1}
        hidden
      >
        <div className="mobile-menu__top">
          <span>
            {settings.issue} — {settings.tagline}
          </span>
          <button
            className="icon-button"
            type="button"
            data-menu-close
            aria-label={t('nav.closeMenu')}
            style={{ color: 'inherit' }}
          >
            <svg
              viewBox="0 0 20 20"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav aria-label={t('nav.mobile')}>
          <a href={href('/articles')}>{t('nav.articles')}</a>
          <a href={href('/topics')}>{t('nav.topics')}</a>
          <a href={href('/archive')}>{t('nav.archive')}</a>
          <a href={href('/saved')}>{t('nav.saved')}</a>
          <a href={href('/about')}>{t('nav.about')}</a>
          <a href={href('/search')}>{t('nav.search')}</a>
        </nav>
        <p className="meta" style={{ marginTop: '2rem', color: 'rgba(255,255,255,.5)' }}>
          {categories.map((category) => (
            <a
              key={category.id}
              href={href(`/category/${category.slug}`)}
              style={{ marginRight: '0.9rem', display: 'inline-block', padding: '0.2rem 0' }}
            >
              {category.name}
            </a>
          ))}
        </p>
      </div>
    </header>
  )
}

export function SiteFooter({ settings, categories }: { settings: SiteSettings; categories: CategoryWithCount[] }) {
  const { t, href } = useI18n()
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="footer-grid">
          <div className="footer-brand">
            <a href={href('/')} className="wordmark" aria-label={t('header.homeLink', { site: settings.title })}>
              <Fleuron size={22} />
              {settings.title}
            </a>
            <p>{settings.description}</p>
            <p className="meta" style={{ marginTop: '1.1rem' }}>
              {settings.issue} · {t('footer.writtenBy')}
            </p>
          </div>
          <div className="footer-col">
            <h2>{t('footer.sections')}</h2>
            <ul>
              {categories.map((category) => (
                <li key={category.id}>
                  <a className={accentClass(category.accent)} href={href(`/category/${category.slug}`)}>
                    {category.name}
                  </a>
                </li>
              ))}
              <li>
                <a href={href('/topics')}>{t('footer.allTopics')} →</a>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h2>{t('footer.index')}</h2>
            <ul>
              <li>
                <a href={href('/articles')}>{t('footer.allArticles')}</a>
              </li>
              <li>
                <a href={href('/topics')}>{t('footer.topics')}</a>
              </li>
              <li>
                <a href={href('/archive')}>{t('footer.archive')}</a>
              </li>
              <li>
                <a href={href('/search')}>{t('footer.search')}</a>
              </li>
              <li>
                <a href={href('/saved')}>{t('footer.saved')}</a>
              </li>
              <li>
                <a href={href('/about')}>{t('footer.about')}</a>
              </li>
              <li>
                <a href={href('/privacy')}>{t('footer.privacy')}</a>
              </li>
              <li>
                <a href={href('/terms')}>{t('footer.terms')}</a>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h2>{t('footer.elsewhere')}</h2>
            <ul>
              <li>
                <a href="/rss.xml">{t('footer.rss')}</a>
              </li>
              <li>
                <a href={href('/subscribe')}>{t('footer.newsletter')}</a>
              </li>
              {settings.email ? (
                <li>
                  <a href={`mailto:${settings.email}`}>{t('footer.email')}</a>
                </li>
              ) : null}
              {settings.x ? (
                <li>
                  <a href={settings.x} rel="noopener noreferrer" target="_blank">
                    X ↗
                  </a>
                </li>
              ) : null}
              {settings.github ? (
                <li>
                  <a href={settings.github} rel="noopener noreferrer" target="_blank">
                    GitHub ↗
                  </a>
                </li>
              ) : null}
              {settings.linkedin ? (
                <li>
                  <a href={settings.linkedin} rel="noopener noreferrer" target="_blank">
                    LinkedIn ↗
                  </a>
                </li>
              ) : null}
              <li>
                <a href="/admin">{t('footer.editorialDesk')}</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-folio">
          <span>
            © {year} Rhandyta Briantama. {t('footer.publishedAs')} {settings.title}.
          </span>
          <span>{t('footer.typeset')}</span>
        </div>
      </div>
    </footer>
  )
}

export function SiteLayout({
  settings,
  categories,
  path,
  children,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  path: string
  children: ReactNode
}) {
  const { t, locale } = useI18n()
  return (
    <>
      <a className="skip-link" href="#main">
        {t('header.skipToContent')}
      </a>
      <SiteHeader settings={settings} categories={categories} path={path} />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter settings={settings} categories={categories} />
      <ClientI18n data={buildClientMessages(t, locale, `/${locale}`)} />
    </>
  )
}

export function NewsletterBand({ settings }: { settings: SiteSettings }) {
  const { t } = useI18n()
  return (
    <section className="newsletter-band" aria-labelledby="newsletter-title">
      <div className="shell">
        <div className="newsletter-band__grid">
          <div>
            <span className="kicker kicker--plain" style={{ color: 'inherit', opacity: 0.6 }}>
              {t('footer.newsletterKicker')}
            </span>
            <h2 id="newsletter-title">{settings.newsletterTitle}</h2>
            <p>{settings.newsletterBlurb}</p>
          </div>
          <form className="newsletter-form" data-newsletter action="/api/subscribe" method="post">
            <input type="hidden" name="source" value="site" />
            <div className="honeypot" aria-hidden="true">
              <label>
                Website
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <label className="sr-only" htmlFor="newsletter-email">
              {t('subscribe.emailLabel')}
            </label>
            <input
              className="input"
              id="newsletter-email"
              type="email"
              name="email"
              placeholder={t('subscribe.emailPlaceholder')}
              autoComplete="email"
              required
            />
            <button className="btn" type="submit">
              {t('subscribe.submit')}
            </button>
            <p className="newsletter-note">{t('subscribe.note')}</p>
            <p className="form-message" data-message role="status" aria-live="polite"></p>
          </form>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 *  Admin shell
 * ------------------------------------------------------------------ */

export type AdminNavStats = { drafts: number; scheduled: number }

const AdminNavStatsContext = createContext<AdminNavStats | undefined>(undefined)

export function AdminNavStatsProvider({ stats, children }: { stats: AdminNavStats | undefined; children: ReactNode }) {
  return <AdminNavStatsContext.Provider value={stats}>{children}</AdminNavStatsContext.Provider>
}

function AdminLink({
  path,
  href,
  label,
  badge,
  badgeTitle,
}: {
  path: string
  href: string
  label: string
  badge?: number
  badgeTitle?: string
}) {
  return (
    <a href={href} aria-current={path === href || (href !== '/admin' && path.startsWith(href)) ? 'page' : undefined}>
      <span>{label}</span>
      {badge !== undefined ? (
        <span className="count" title={badgeTitle}>
          {badge}
        </span>
      ) : null}
    </a>
  )
}

export function AdminLayout({
  user,
  path,
  children,
  title,
  subtitle,
  actions,
  flash,
  stats,
  csrfToken,
}: {
  user: User
  path: string
  children: ReactNode
  title: string
  subtitle?: string
  actions?: ReactNode
  flash?: { tone: 'success' | 'error'; message: string } | null
  stats?: AdminNavStats
  csrfToken?: string
}) {
  const { t } = useI18n()
  const contextStats = useContext(AdminNavStatsContext)
  const navStats = stats ?? contextStats
  const role = t(roleKey(user.role))
  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <a href="/admin" className="wordmark" style={{ color: 'inherit' }}>
          <Fleuron size={18} />
          {`RhandytaVERSE`}
        </a>
        <div className="admin-side__context">{t('admin.desk')}</div>
        <nav className="admin-nav" aria-label={t('admin.navLabel')}>
          <AdminLink path={path} href="/admin" label={t('admin.overview')} />
          <AdminLink
            path={path}
            href="/admin/articles"
            label={t('admin.articles')}
            badge={navStats?.drafts}
            badgeTitle={navStats ? t('admin.draftsBadge', { count: navStats.drafts }) : undefined}
          />
          <AdminLink path={path} href="/admin/media" label={t('admin.media')} />
          {user.role !== 'author' ? (
            <>
              <AdminLink path={path} href="/admin/automation" label={t('admin.automation')} />
              <div className="admin-nav__group">{t('admin.organise')}</div>
              <AdminLink path={path} href="/admin/categories" label={t('admin.categories')} />
              <AdminLink path={path} href="/admin/tags" label={t('admin.tags')} />
              <AdminLink path={path} href="/admin/authors" label={t('admin.authors')} />
              <div className="admin-nav__group">{t('admin.audience')}</div>
              <AdminLink path={path} href="/admin/analytics" label={t('admin.analytics')} />
              <AdminLink path={path} href="/admin/subscribers" label={t('admin.subscribers')} />
              <AdminLink path={path} href="/admin/newsletter" label={t('admin.newsletter')} />
              <div className="admin-nav__group">{t('admin.settings')}</div>
              <AdminLink path={path} href="/admin/settings" label={t('admin.settings')} />
              {user.role === 'admin' ? <AdminLink path={path} href="/admin/users" label={t('admin.users')} /> : null}
              {user.role === 'admin' ? <AdminLink path={path} href="/admin/audit" label={t('admin.auditLog')} /> : null}
              {user.role === 'admin' ? <AdminLink path={path} href="/admin/system" label={t('admin.system')} /> : null}
            </>
          ) : null}
          <div className="admin-nav__group">{t('admin.account')}</div>
          <AdminLink path={path} href="/admin/account" label={t('admin.account')} />
        </nav>
        <div className="admin-side__foot">
          <a href="/" target="_blank" rel="noopener">
            {t('admin.viewSite')} ↗
          </a>
          <span>{t('admin.signedInAs', { name: user.name, role })}</span>
          <LanguageSwitcher variant="admin" />
          <form method="post" action="/admin/logout">
            {csrfToken ? <input type="hidden" name="_csrf" value={csrfToken} /> : null}
            <button type="submit">{t('admin.signOut')}</button>
          </form>
        </div>
      </aside>
      <div className="admin-main">
        <div className="admin-topbar">
          <div>
            <h1>{title}</h1>
            {subtitle ? <p className="admin-topbar__sub">{subtitle}</p> : null}
          </div>
          {actions ? <div className="admin-topbar__actions">{actions}</div> : null}
        </div>
        {flash ? (
          <div className="flash" data-tone={flash.tone} role="status">
            {flash.message}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  )
}
