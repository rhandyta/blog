import { createContext, useContext, type ReactNode } from 'react'
import type { SiteSettings, CategoryWithCount } from '../lib/db/queries/taxonomy'
import type { User } from '../lib/db/schema'
import { roleLabel } from '../lib/auth/permissions'
import { ui } from '../lib/content/ui-copy'
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

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
      <path d="M5 3.5h10v13l-5-3.5-5 3.5v-13Z" strokeLinejoin="round" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg className="icon-sun" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="3.4" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M15.7 4.3l-1.4 1.4M5.7 14.3l-1.4 1.4" strokeLinecap="round" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="icon-moon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
      <path d="M16.5 12.4A7 7 0 0 1 7.6 3.5a7 7 0 1 0 8.9 8.9Z" strokeLinejoin="round" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false" width="18" height="18">
      <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
    </svg>
  )
}

export function ThemeToggle() {
  return (
    <button className="icon-button theme-toggle" type="button" data-theme-toggle aria-label={ui.header.themeToggle}>
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
  const today = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  return (
    <header className="site-header">
      <div className="utility-bar">
        <div className="shell">
          <span>
            {settings.issue} — {settings.tagline}
          </span>
          <div className="utility-bar__links">
            <span>{today}</span>
            <a href="/archive">{ui.nav.archive}</a>
            <a href="/saved" className="saved-link" aria-label={ui.header.savedLabel}>
              {ui.nav.saved} <span className="saved-count" data-saved-count></span>
            </a>
            <ThemeToggle />
            <a href="/search" className="icon-button" aria-label={ui.header.searchLabel}>
              <SearchIcon />
            </a>
          </div>
        </div>
      </div>

      <div className="shell masthead">
        <a href="/" className="wordmark" aria-label={`${settings.title} — home`}>
          <Fleuron size={19} />
          {settings.title}
        </a>
        <nav className="primary-nav" aria-label={ui.nav.primary}>
          <a href="/articles" aria-current={isCurrent(path, '/articles') ? 'page' : undefined}>
            {ui.nav.articles}
          </a>
          <a href="/topics" aria-current={isCurrent(path, '/topics') ? 'page' : undefined}>
            {ui.nav.topics}
          </a>
          <a href="/archive" aria-current={isCurrent(path, '/archive') ? 'page' : undefined}>
            {ui.nav.archive}
          </a>
          <a href="/about" aria-current={isCurrent(path, '/about') ? 'page' : undefined}>
            {ui.nav.about}
          </a>
        </nav>
        <button className="icon-button menu-toggle" type="button" data-menu-open aria-expanded="false" aria-controls="mobile-menu" aria-label={ui.nav.openMenu}>
          <MenuIcon />
        </button>
      </div>

      <div
        className="mobile-menu"
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label={ui.nav.menu}
        tabIndex={-1}
        hidden
      >
        <div className="mobile-menu__top">
          <span>{settings.issue} — {settings.tagline}</span>
          <button className="icon-button" type="button" data-menu-close aria-label={ui.nav.closeMenu} style={{ color: 'inherit' }}>
            <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav aria-label={ui.nav.mobile}>
          <a href="/articles">{ui.nav.articles}</a>
          <a href="/topics">{ui.nav.topics}</a>
          <a href="/archive">{ui.nav.archive}</a>
          <a href="/saved">{ui.nav.saved}</a>
          <a href="/about">{ui.nav.about}</a>
          <a href="/search">{ui.nav.search}</a>
        </nav>
        <p className="meta" style={{ marginTop: '2rem', color: 'rgba(255,255,255,.5)' }}>
          {categories.map((category) => (
            <a key={category.id} href={`/category/${category.slug}`} style={{ marginRight: '0.9rem', display: 'inline-block', padding: '0.2rem 0' }}>
              {category.name}
            </a>
          ))}
        </p>
      </div>
    </header>
  )
}

export function SiteFooter({
  settings,
  categories,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
}) {
  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="footer-grid">
          <div className="footer-brand">
            <a href="/" className="wordmark" aria-label={`${settings.title} — home`}>
              <Fleuron size={22} />
              {settings.title}
            </a>
            <p>{settings.description}</p>
            <p className="meta" style={{ marginTop: '1.1rem' }}>
              {settings.issue} · {ui.footer.writtenBy}
            </p>
          </div>
          <div className="footer-col">
            <h2>{ui.footer.sections}</h2>
            <ul>
              {categories.map((category) => (
                <li key={category.id}>
                  <a className={accentClass(category.accent)} href={`/category/${category.slug}`}>
                    {category.name}
                  </a>
                </li>
              ))}
              <li><a href="/topics">{ui.footer.allTopics} →</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h2>{ui.footer.index}</h2>
            <ul>
              <li><a href="/articles">{ui.footer.allArticles}</a></li>
              <li><a href="/topics">{ui.footer.topics}</a></li>
              <li><a href="/archive">{ui.footer.archive}</a></li>
              <li><a href="/search">{ui.footer.search}</a></li>
              <li><a href="/saved">{ui.footer.saved}</a></li>
              <li><a href="/about">{ui.footer.about}</a></li>
              <li><a href="/privacy">{ui.footer.privacy}</a></li>
              <li><a href="/terms">{ui.footer.terms}</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h2>{ui.footer.elsewhere}</h2>
            <ul>
              <li><a href="/rss.xml">{ui.footer.rss}</a></li>
              <li><a href="/subscribe">{ui.footer.newsletter}</a></li>
              {settings.email ? <li><a href={`mailto:${settings.email}`}>{ui.footer.email}</a></li> : null}
              {settings.x ? <li><a href={settings.x} rel="noopener noreferrer" target="_blank">X ↗</a></li> : null}
              {settings.github ? <li><a href={settings.github} rel="noopener noreferrer" target="_blank">GitHub ↗</a></li> : null}
              {settings.linkedin ? <li><a href={settings.linkedin} rel="noopener noreferrer" target="_blank">LinkedIn ↗</a></li> : null}
              <li><a href="/admin">{ui.footer.editorialDesk}</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-folio">
          <span>© {new Date().getFullYear()} Rhandyta Briantama. {ui.footer.publishedAs} {settings.title}.</span>
          <span>{ui.footer.typeset}</span>
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
  return (
    <>
      <a className="skip-link" href="#main">
        {ui.header.skipToContent}
      </a>
      <SiteHeader settings={settings} categories={categories} path={path} />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter settings={settings} categories={categories} />
    </>
  )
}

export function NewsletterBand({ settings }: { settings: SiteSettings }) {
  return (
    <section className="newsletter-band" aria-labelledby="newsletter-title">
      <div className="shell">
        <div className="newsletter-band__grid">
          <div>
            <span className="kicker kicker--plain" style={{ color: 'inherit', opacity: 0.6 }}>
              Surat kabar
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
              {ui.subscribe.emailLabel}
            </label>
            <input
              className="input"
              id="newsletter-email"
              type="email"
              name="email"
              placeholder={ui.subscribe.emailPlaceholder}
              autoComplete="email"
              required
            />
            <button className="btn" type="submit">
              {ui.subscribe.submit}
            </button>
            <p className="newsletter-note">
              {ui.subscribe.note}
            </p>
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

export function AdminNavStatsProvider({
  stats,
  children,
}: {
  stats: AdminNavStats | undefined
  children: ReactNode
}) {
  return <AdminNavStatsContext.Provider value={stats}>{children}</AdminNavStatsContext.Provider>
}

function adminLink(path: string, href: string, label: string, badge?: number, badgeTitle?: string) {
  return (
    <a key={href} href={href} aria-current={path === href || (href !== '/admin' && path.startsWith(href)) ? 'page' : undefined}>
      <span>{label}</span>
      {badge !== undefined ? <span className="count" title={badgeTitle}>{badge}</span> : null}
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
  const contextStats = useContext(AdminNavStatsContext)
  const navStats = stats ?? contextStats
  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <a href="/admin" className="wordmark" style={{ color: 'inherit' }}>
          <Fleuron size={18} />
          {`RhandytaVERSE`}
        </a>
        <div className="admin-side__context">Editorial desk</div>
        <nav className="admin-nav" aria-label="Admin">
          {adminLink(path, '/admin', 'Overview')}
          {adminLink(
            path,
            '/admin/articles',
            'Articles',
            navStats?.drafts,
            navStats ? `${navStats.drafts} draft${navStats.drafts === 1 ? '' : 's'}` : undefined,
          )}
          {adminLink(path, '/admin/media', 'Media')}
          {adminLink(path, '/admin/automation', 'Automation')}
          {user.role !== 'author' ? (
            <>
              <div className="admin-nav__group">Organise</div>
              {adminLink(path, '/admin/categories', 'Categories')}
              {adminLink(path, '/admin/tags', 'Tags')}
              {adminLink(path, '/admin/authors', 'Authors')}
              <div className="admin-nav__group">Audience</div>
              {adminLink(path, '/admin/analytics', 'Analytics')}
              {adminLink(path, '/admin/subscribers', 'Subscribers')}
              {adminLink(path, '/admin/newsletter', 'Newsletter')}
              <div className="admin-nav__group">Settings</div>
              {adminLink(path, '/admin/settings', 'Settings')}
              {user.role === 'admin' ? adminLink(path, '/admin/audit', 'Audit log') : null}
            </>
          ) : null}
        </nav>
        <div className="admin-side__foot">
          <a href="/" target="_blank" rel="noopener">View site ↗</a>
          <span>{user.name} · {roleLabel(user.role)}</span>
          <form method="post" action="/admin/logout">
            {csrfToken ? <input type="hidden" name="_csrf" value={csrfToken} /> : null}
            <button type="submit">Sign out</button>
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
        {flash ? <div className="flash" data-tone={flash.tone} role="status">{flash.message}</div> : null}
        {children}
      </div>
    </div>
  )
}
