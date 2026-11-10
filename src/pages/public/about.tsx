import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
import type { Author } from '../../lib/db/schema'
import { splitParagraphs } from '../../lib/content/html'
import { aboutDocument, interpolate, useI18n } from '../../lib/i18n'
import { SiteLayout } from '../../components/layout'
import { Kicker } from '../../components/ui'

export function AboutPage({
  settings,
  categories,
  articleCount,
  author,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  articleCount: number
  author: Author | null
}) {
  const { t, href, locale } = useI18n()
  const copy = aboutDocument[locale]
  const paragraphs = splitParagraphs(settings.about)
  const personName = author?.displayName ?? 'Rhandyta Briantama'
  const personSlug = author?.slug ?? 'rhandyta-briantama'
  const vars = { name: personName, site: settings.title }
  const fill = (value: string) => interpolate(value, vars)

  return (
    <SiteLayout settings={settings} categories={categories} path="/about">
      <section className="about-hero">
        <div className="shell">
          <Kicker plain>{t('about.kicker')}</Kicker>
          <h1 style={{ marginTop: '1rem' }}>{t('home.aboutTitle', { site: settings.title, name: personName })}</h1>
          <p className="lede" style={{ marginTop: '1.5rem', maxWidth: '46ch' }}>
            {t('about.lede')}
          </p>
        </div>
      </section>

      <div className="shell">
        <div className="about-layout">
          <div className="about-copy">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}

            <h2>{copy.personHeading}</h2>
            {copy.personParagraphs.map((paragraph) => (
              <p key={paragraph}>{fill(paragraph)}</p>
            ))}
            <p>
              <a className="text-link" href={href(`/author/${personSlug}`)}>
                {t('about.readAuthor')} →
              </a>
            </p>

            <h2>{copy.findHeading}</h2>
            {copy.findParagraphs.map((paragraph) => (
              <p key={paragraph}>{fill(paragraph)}</p>
            ))}

            <blockquote>{settings.manifesto}</blockquote>

            <h2>{copy.howHeading}</h2>
            {copy.howParagraphs.map((paragraph) => (
              <p key={paragraph}>{fill(paragraph)}</p>
            ))}

            <h2>{copy.independenceHeading}</h2>
            {copy.independenceParagraphs.map((paragraph) => (
              <p key={paragraph}>{fill(paragraph)}</p>
            ))}

            <h2>{t('about.correspondence')}</h2>
            <p>{copy.correspondenceBody}</p>
          </div>

          <aside className="about-aside">
            <h2>{t('about.colophon')}</h2>
            <ul>
              <li>
                <span className="meta">{copy.colophon.editor}</span>
                <br />
                {personName}
              </li>
              <li>
                <span className="meta">{copy.colophon.issue}</span>
                <br />
                {settings.issue}
              </li>
              <li>
                <span className="meta">{copy.colophon.sections}</span>
                <br />
                {categories.length}
              </li>
              <li>
                <span className="meta">{copy.colophon.pieces}</span>
                <br />
                {articleCount}
              </li>
              <li>
                <span className="meta">{copy.colophon.type}</span>
                <br />
                Fraunces &amp; Newsreader
              </li>
              <li>
                <span className="meta">{copy.colophon.engine}</span>
                <br />
                Bun, Hono, React SSR, SQLite
              </li>
            </ul>
            <h2 style={{ marginTop: '2rem' }}>{t('about.elsewhere')}</h2>
            <ul>
              <li>
                <a href="/rss.xml">{t('footer.rss')}</a>
              </li>
              <li>
                <a href={href('/subscribe')}>{t('footer.newsletter')}</a>
              </li>
              <li>
                <a href={href('/privacy')}>{t('footer.privacy')}</a>
              </li>
              <li>
                <a href={href('/terms')}>{t('footer.terms')}</a>
              </li>
              {settings.email ? (
                <li>
                  <a href={`mailto:${settings.email}`}>{settings.email}</a>
                </li>
              ) : null}
              {settings.github ? (
                <li>
                  <a href={settings.github} rel="noopener noreferrer" target="_blank">
                    GitHub ↗
                  </a>
                </li>
              ) : null}
              <li>
                <a href="/admin">{t('footer.editorialDesk')}</a>
              </li>
            </ul>
            <p className="meta" style={{ marginTop: '2rem', lineHeight: 1.8 }}>
              {t('about.privacyNote')} <a href={href('/privacy')}>{t('about.privacyLink')}</a>.
            </p>
          </aside>
        </div>
      </div>
    </SiteLayout>
  )
}
