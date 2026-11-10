import type { ReactNode } from 'react'
import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
import { privacyDocument, termsDocument, useI18n, type LegalDocument } from '../../lib/i18n'
import { SiteLayout } from '../../components/layout'
import { EmailParagraph } from '../../components/rich-text'
import { Kicker } from '../../components/ui'

function LegalShell({
  settings,
  categories,
  path,
  document,
  children,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  path: string
  document: LegalDocument
  children: ReactNode
}) {
  const { t, href, formatDate } = useI18n()
  return (
    <SiteLayout settings={settings} categories={categories} path={path}>
      <section className="page-hero">
        <div className="shell">
          <Kicker plain>{document.kicker}</Kicker>
          <h1 className="display-lg" style={{ marginTop: '1rem' }}>
            {document.title}
          </h1>
          <p className="meta" style={{ marginTop: '0.75rem' }}>
            {t('legal.lastUpdated', { date: formatDate(document.updated, 'long') })}
          </p>
        </div>
      </section>
      <div className="shell">
        <div className="about-layout" style={{ paddingTop: 'clamp(2rem, 4vw, 3rem)' }}>
          <div className="about-copy">{children}</div>
          <aside className="about-aside">
            <h2>{t('legal.contactTitle')}</h2>
            <p>
              Rhandyta Briantama
              <br />
              {settings.email ? <a href={`mailto:${settings.email}`}>{settings.email}</a> : null}
            </p>
            <p className="meta" style={{ marginTop: '1rem' }}>
              {t('legal.contactNote')}
            </p>
            <p className="meta" style={{ marginTop: '1rem' }}>
              <a href={href('/privacy')}>{t('footer.privacy')}</a> · <a href={href('/terms')}>{t('footer.terms')}</a>
            </p>
          </aside>
        </div>
      </div>
    </SiteLayout>
  )
}

function LegalBody({ document, email, fallback }: { document: LegalDocument; email: string; fallback: string }) {
  return (
    <>
      {document.sections.map((section, index) => (
        <section key={section.heading ?? `intro-${index}`}>
          {section.heading ? <h2>{section.heading}</h2> : null}
          {section.paragraphs.map((paragraph) => (
            <EmailParagraph key={paragraph} text={paragraph} email={email} fallback={fallback} />
          ))}
        </section>
      ))}
    </>
  )
}

export function PrivacyPage({ settings, categories }: { settings: SiteSettings; categories: CategoryWithCount[] }) {
  const { locale, t } = useI18n()
  const document = privacyDocument[locale]
  return (
    <LegalShell settings={settings} categories={categories} path="/privacy" document={document}>
      <LegalBody document={document} email={settings.email} fallback={t('legal.contactFallback')} />
    </LegalShell>
  )
}

export function TermsPage({ settings, categories }: { settings: SiteSettings; categories: CategoryWithCount[] }) {
  const { locale, t } = useI18n()
  const document = termsDocument[locale]
  return (
    <LegalShell settings={settings} categories={categories} path="/terms" document={document}>
      <LegalBody document={document} email={settings.email} fallback={t('legal.contactFallback')} />
    </LegalShell>
  )
}
