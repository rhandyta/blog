import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
import type { Author } from '../../lib/db/schema'
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
  const paragraphs = settings.about.split(/\n{2,}/).filter(Boolean)
  const personName = author?.displayName ?? 'Rhandyta Briantama'
  const personSlug = author?.slug ?? 'rhandyta-briantama'
  return (
    <SiteLayout settings={settings} categories={categories} path="/about">
      <section className="about-hero">
        <div className="shell">
          <Kicker plain>About</Kicker>
          <h1 style={{ marginTop: '1rem' }}>
            {settings.title} is {personName}.
          </h1>
          <p className="lede" style={{ marginTop: '1.5rem', maxWidth: '46ch' }}>
            A personal publication, written and edited by one person. The name and the person are the same project:
            one reader, one desk, one ongoing record.
          </p>
        </div>
      </section>

      <div className="shell">
        <div className="about-layout">
          <div className="about-copy">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}

            <h2>The person behind the publication</h2>
            <p>
              <strong>{personName}</strong> writes and edits {settings.title}. The publication is not a separate brand
              with a separate voice; it is one person's working record, kept in public.
            </p>
            <p>
              <a className="text-link" href={`/author/${personSlug}`}>Read the author page →</a>
            </p>

            <h2>What you will find here</h2>
            <p>
              Essays and notes on technology, design, science, culture, work, and the ordinary business of paying
              attention. The subjects are deliberately unconstrained. The publication has no subject because a person
              does not have a subject.
            </p>
            <p>
              Pieces are filed under sections, tagged loosely, and kept in a complete chronological archive. Nothing is
              placed behind a paywall, an account, or a modal.
            </p>

            <blockquote>{settings.manifesto}</blockquote>

            <h2>How it is made</h2>
            <p>
              RhandytaVERSE is a small, self-contained publishing platform. Pages are rendered on the server, the text is
              stored in a serverless SQLite database, images are processed into modern formats at upload, and the only
              client-side JavaScript covers a handful of interactions: the theme switch, reading progress, search, and
              saving an article for later.
            </p>
            <p>
              The typefaces are hosted alongside the site rather than fetched from a third party. There are no
              trackers, no advertising scripts, and no external analytics. Readership is measured first-party with no
              analytics cookies and no raw IP addresses.
            </p>

            <h2>Editorial independence</h2>
            <p>
              {settings.title} is independently written and edited by {personName}. Nothing is published on a fixed
              schedule; pieces are added when there is something worth saying. The archive is kept in full, and
              corrections are noted in the piece rather than quietly removed.
            </p>

            <h2>Corrections and correspondence</h2>
            <p>
              For a publication of this size, the correct address is a plain email. Corrections are noted in the piece
              rather than quietly removed. If something here is wrong, say so.
            </p>
          </div>

          <aside className="about-aside">
            <h2>Colophon</h2>
            <ul>
              <li><span className="meta">Editor</span><br />{personName}</li>
              <li><span className="meta">Issue</span><br />{settings.issue}</li>
              <li><span className="meta">Sections</span><br />{categories.length}</li>
              <li><span className="meta">Pieces</span><br />{articleCount}</li>
              <li><span className="meta">Typography</span><br />Fraunces &amp; Newsreader</li>
              <li><span className="meta">Engine</span><br />Bun, Hono, React SSR, SQLite</li>
            </ul>
            <h2 style={{ marginTop: '2rem' }}>Elsewhere</h2>
            <ul>
              <li><a href="/rss.xml">RSS feed</a></li>
              <li><a href="/subscribe">Newsletter</a></li>
              {settings.email ? <li><a href={`mailto:${settings.email}`}>{settings.email}</a></li> : null}
              {settings.github ? (
                <li><a href={settings.github} rel="noopener noreferrer" target="_blank">GitHub ↗</a></li>
              ) : null}
              <li><a href="/admin">Editorial desk</a></li>
            </ul>
            <p className="meta" style={{ marginTop: '2rem', lineHeight: 1.8 }}>
              No third-party trackers. No advertising. First-party, cookie-less readership.
            </p>
          </aside>
        </div>
      </div>
    </SiteLayout>
  )
}
