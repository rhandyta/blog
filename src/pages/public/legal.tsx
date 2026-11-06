import type { ReactNode } from 'react'
import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
import { SiteLayout } from '../../components/layout'
import { Kicker } from '../../components/ui'

function LegalShell({
  settings,
  categories,
  path,
  kicker,
  title,
  updated,
  children,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  path: string
  kicker: string
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <SiteLayout settings={settings} categories={categories} path={path}>
      <section className="page-hero">
        <div className="shell">
          <Kicker plain>{kicker}</Kicker>
          <h1 className="display-lg" style={{ marginTop: '1rem' }}>{title}</h1>
          <p className="meta" style={{ marginTop: '0.75rem' }}>Last updated {updated}</p>
        </div>
      </section>
      <div className="shell">
        <div className="about-layout" style={{ paddingTop: 'clamp(2rem, 4vw, 3rem)' }}>
          <div className="about-copy">{children}</div>
          <aside className="about-aside">
            <h2>Contact</h2>
            <p>
              Rhandyta Briantama<br />
              {settings.email ? <a href={`mailto:${settings.email}`}>{settings.email}</a> : null}
            </p>
            <p className="meta" style={{ marginTop: '1rem' }}>
              This page is a plain-language policy for a personal publication, not a substitute for legal advice.
            </p>
          </aside>
        </div>
      </div>
    </SiteLayout>
  )
}

export function PrivacyPage({
  settings,
  categories,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
}) {
  return (
    <LegalShell
      settings={settings}
      categories={categories}
      path="/privacy"
      kicker="Privacy"
      title="Privacy policy"
      updated="6 November 2026"
    >
      <p>
        RhandytaVERSE is a personal publication written and edited by Rhandyta Briantama. This policy explains what
        the site collects, why it collects it, and how to have it removed.
      </p>

      <h2>Newsletter</h2>
      <p>
        If you subscribe, I store your email address, subscription status, source, and timestamps for confirmation and
        unsubscription. New subscribers must confirm by email before they are added to the list. I use Resend to
        deliver confirmation messages and newsletters; Resend processes the address and delivery data on my behalf.
      </p>
      <p>
        Your address is used only for the newsletter and is never sold. You can unsubscribe from any letter using the
        unsubscribe link, or ask me to remove your address. Removing a subscriber from the editorial desk deletes the
        stored subscriber record.
      </p>

      <h2>Readership and visitor analytics</h2>
      <p>
        The editorial desk measures readership without analytics cookies, advertising networks, or third-party
        trackers. Raw IP addresses and raw user-agent strings are not stored. A visitor identifier is a salted hash
        used only to deduplicate reads; the address is masked before hashing. I store coarse device, browser, operating
        system, country, and external referrer-host information for aggregate reporting.
      </p>
      <p>
        Analytics events are retained for 180 days. Aggregate unique-reader counts are retained so article totals
        remain meaningful. DNT and Global Privacy Control requests are excluded. Internal/admin visits, bots, and
        prefetches are excluded.
      </p>

      <h2>Hosting and processors</h2>
      <p>
        The site runs on Vercel, uses Turso for the production database, Vercel Blob for media, and Resend for email.
        These providers process data as infrastructure/subprocessors. I do not sell personal data or use it for
        advertising.
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        Public readers do not receive analytics cookies. The editorial desk uses a first-party session cookie for
        sign-in. The site may use browser local storage for theme and saved-article preferences; those preferences stay
        in your browser.
      </p>

      <h2>Your choices</h2>
      <p>
        You can unsubscribe at any time, request a copy of your subscriber record, or ask for deletion. Email{' '}
        {settings.email ? <a href={`mailto:${settings.email}`}>{settings.email}</a> : 'the contact address'} with the
        address you used. Because analytics identifiers are not linked to subscriber email addresses, I cannot connect
        an analytics record to a named person.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes materially, the “last updated” date at the top will change. Continued use of the site
        after a change means you accept the revised policy.
      </p>
    </LegalShell>
  )
}

export function TermsPage({
  settings,
  categories,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
}) {
  return (
    <LegalShell
      settings={settings}
      categories={categories}
      path="/terms"
      kicker="Terms"
      title="Terms of use"
      updated="6 November 2026"
    >
      <p>
        These terms apply to RhandytaVERSE, a personal publication operated by Rhandyta Briantama. By reading or
        subscribing, you agree to them.
      </p>

      <h2>Content</h2>
      <p>
        Essays, notes, images, and other material on this site are written or commissioned by Rhandyta Briantama unless
        otherwise credited. You may quote short excerpts with attribution and a link. Do not republish substantial
        portions, scrape the archive for model training, or present the work as your own without permission.
      </p>

      <h2>Newsletter</h2>
      <p>
        The newsletter is a personal letter, not a news service or a guaranteed schedule. Subscriptions require
        confirmation. You can unsubscribe at any time. Do not subscribe addresses you do not control.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Do not attempt to disrupt the site, bypass access controls, scrape at a rate that degrades service, or use the
        contact form/newsletter for spam, harassment, or unlawful activity.
      </p>

      <h2>Third-party links</h2>
      <p>
        Links to other sites are provided for context. I do not control those sites and am not responsible for their
        content, availability, or privacy practices.
      </p>

      <h2>No warranty</h2>
      <p>
        The publication is provided as-is. I aim for accuracy, but I do not warrant that every statement is complete,
        current, or suitable for a particular purpose. Nothing here is professional, legal, financial, or medical
        advice.
      </p>

      <h2>Changes</h2>
      <p>
        I may update these terms; the “last updated” date will change. Material changes will be reflected on this
        page. Questions can go to {settings.email ? <a href={`mailto:${settings.email}`}>{settings.email}</a> : 'the contact address'}.
      </p>
    </LegalShell>
  )
}
