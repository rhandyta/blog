import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
import { SiteLayout } from '../../components/layout'
import { Kicker } from '../../components/ui'

export function AboutPage({
  settings,
  categories,
  articleCount,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  articleCount: number
}) {
  const paragraphs = settings.about.split(/\n{2,}/).filter(Boolean)
  return (
    <SiteLayout settings={settings} categories={categories} path="/about">
      <section className="about-hero">
        <div className="shell">
          <Kicker plain>About</Kicker>
          <h1 style={{ marginTop: '1rem' }}>
            A commonplace book, kept in public.
          </h1>
          <p className="lede" style={{ marginTop: '1.5rem', maxWidth: '46ch' }}>
            {settings.tagline}. An independent publication about the things worth returning to — without a niche, a
            schedule, or an audience to chase.
          </p>
        </div>
      </section>

      <div className="shell">
        <div className="about-layout">
          <div className="about-copy">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}

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
              Commonplace is a small, self-contained publishing platform. Pages are rendered on the server, the text is
              stored in a local SQLite database, images are processed into modern formats at upload, and the only
              client-side JavaScript covers a handful of interactions: the theme switch, reading progress, search, and
              saving an article for later.
            </p>
            <p>
              The typefaces are hosted alongside the site rather than fetched from a third party. There are no
              trackers, no advertising scripts, and no external analytics.
            </p>

            <h2>A note on the demonstration</h2>
            <p>
              This site is a working prototype, and its contents are demonstration material. The authors are
              illustrative profiles rather than real people, and the essays were written for this project. The
              editorial desk is real: signing in with the demonstration credentials described in the project README
              allows you to create, edit, schedule, and publish articles.
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
              <li><a href="/admin">Editorial desk</a></li>
            </ul>
            <p className="meta" style={{ marginTop: '2rem', lineHeight: 1.8 }}>
              Built as a demonstration publishing platform. No third-party trackers, no advertising.
            </p>
          </aside>
        </div>
      </div>
    </SiteLayout>
  )
}
