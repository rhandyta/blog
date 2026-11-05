import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
import { NewsletterBand, SiteLayout } from '../../components/layout'
import { Kicker } from '../../components/ui'

export function SubscribePage({
  settings,
  categories,
  status,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  status?: 'ok' | 'exists' | 'invalid' | 'error' | null
}) {
  const message =
    status === 'ok'
      ? 'You are on the list. The address is stored in this site’s database — no email is sent by this prototype.'
      : status === 'exists'
        ? 'That address is already subscribed.'
        : status === 'invalid'
          ? 'That email address does not look right. Please check it and try again.'
          : status === 'error'
            ? 'Something went wrong while saving your address. Please try again shortly.'
            : null

  return (
    <SiteLayout settings={settings} categories={categories} path="/subscribe">
      <section className="page-hero">
        <div className="shell">
          <div className="page-hero__grid">
            <div>
              <Kicker plain>The letter</Kicker>
              <h1 className="display-lg" style={{ marginTop: '1rem' }}>Subscribe</h1>
            </div>
            <div>
              <p>
                A note when there is something worth sending. New essays, occasional fragments, and no schedule to
                keep up with.
              </p>
              <div className="page-hero__meta">
                <a className="text-link" href="/rss.xml">Prefer RSS? →</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {message ? (
        <div className="shell" style={{ paddingTop: '1.5rem' }}>
          <div className="flash" data-tone={status === 'ok' || status === 'exists' ? 'success' : 'error'} role="status">
            {message}
          </div>
        </div>
      ) : null}

      <NewsletterBand settings={settings} />

      <div className="shell">
        <div className="about-layout" style={{ paddingTop: 'clamp(2rem, 4vw, 3rem)' }}>
          <div className="about-copy">
            <h2 style={{ marginTop: 0 }}>What happens when you subscribe</h2>
            <p>
              Your address is normalised, checked, and stored in this site’s own database. Nothing is shared with a
              third party, because there is no third party. You can remove yourself at any time using the unsubscribe
              link included in the demonstration letter flow.
            </p>
            <h2>About this prototype</h2>
            <p>
              This deployment does not connect to a transactional email provider, so no message will actually arrive.
              The subscription itself is real: it persists, it is visible in the editorial dashboard, and it can be
              exported. The README documents where a mail provider would be connected.
            </p>
          </div>
          <aside className="about-aside">
            <h2>Other routes</h2>
            <ul>
              <li><a href="/rss.xml">RSS feed</a></li>
              <li><a href="/articles">All articles</a></li>
              <li><a href="/about">About the publication</a></li>
            </ul>
          </aside>
        </div>
      </div>
    </SiteLayout>
  )
}

export function UnsubscribePage({
  settings,
  categories,
  status,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  status: 'done' | 'invalid'
}) {
  return (
    <SiteLayout settings={settings} categories={categories} path="/unsubscribe">
      <section className="page-hero">
        <div className="shell">
          <Kicker plain>The letter</Kicker>
          <h1 className="display-lg" style={{ marginTop: '1rem' }}>
            {status === 'done' ? 'You are unsubscribed.' : 'This link is not valid.'}
          </h1>
          <p className="lede" style={{ marginTop: '1.5rem', maxWidth: '46ch' }}>
            {status === 'done'
              ? 'Your address has been removed from the newsletter list. You will not receive any further letters from this prototype.'
              : 'The unsubscribe token could not be verified. If you believe this is an error, use the contact address on the about page.'}
          </p>
          <p style={{ marginTop: '1.75rem' }}>
            <a className="btn btn--ghost" href="/">Return home</a>
          </p>
        </div>
      </section>
    </SiteLayout>
  )
}
