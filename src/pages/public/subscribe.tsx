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
  status?: 'ok' | 'pending' | 'exists' | 'invalid' | 'error' | null
}) {
  const message =
    status === 'ok'
      ? 'You are on the list. Thank you for subscribing.'
      : status === 'pending'
        ? 'Check your inbox and click the confirmation link to join the list.'
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
          <div className="flash" data-tone={status === 'ok' || status === 'pending' || status === 'exists' ? 'success' : 'error'} role="status">
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
              Your address is checked and stored securely in this site’s own database. You will receive a confirmation
              email; click the link in that message to join the list. The address is used only for the newsletter and
              is never shared or sold. You can remove yourself at any time using the unsubscribe link in any letter, or
              by contacting Rhandyta Briantama.
            </p>
            <h2>Privacy</h2>
            <p>
              Your address is used only to send the newsletter. It is never sold or shared. To request removal, use the
              unsubscribe link in any letter or contact Rhandyta Briantama directly.
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

export function ConfirmPage({
  settings,
  categories,
  status,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  status: 'done' | 'invalid'
}) {
  return (
    <SiteLayout settings={settings} categories={categories} path="/confirm">
      <section className="page-hero">
        <div className="shell">
          <Kicker plain>The letter</Kicker>
          <h1 className="display-lg" style={{ marginTop: '1rem' }}>
            {status === 'done' ? 'Subscription confirmed.' : 'This link is invalid or expired.'}
          </h1>
          <p className="lede" style={{ marginTop: '1.5rem', maxWidth: '46ch' }}>
            {status === 'done'
              ? 'You are on the list. You can close this page now.'
              : 'The confirmation token could not be verified. Subscribe again to receive a fresh link.'}
          </p>
          <p style={{ marginTop: '1.75rem' }}>
            <a className="btn btn--ghost" href="/">Return home</a>
          </p>
        </div>
      </section>
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
              ? 'Your address has been removed from the newsletter list. You will not receive any further letters.'
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
