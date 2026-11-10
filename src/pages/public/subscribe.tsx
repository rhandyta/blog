import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
import { useI18n } from '../../lib/i18n'
import { NewsletterBand, SiteLayout } from '../../components/layout'
import { Kicker } from '../../components/ui'

type SubscribeStatus = 'ok' | 'pending' | 'exists' | 'invalid' | 'error' | null

export function SubscribePage({
  settings,
  categories,
  status,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  status?: SubscribeStatus
}) {
  const { t, href } = useI18n()
  const message =
    status === 'ok'
      ? t('subscribe.statusOk')
      : status === 'pending'
        ? t('subscribe.statusPending')
        : status === 'exists'
          ? t('subscribe.statusExists')
          : status === 'invalid'
            ? t('subscribe.statusInvalid')
            : status === 'error'
              ? t('subscribe.statusError')
              : null

  return (
    <SiteLayout settings={settings} categories={categories} path="/subscribe">
      <section className="page-hero">
        <div className="shell">
          <div className="page-hero__grid">
            <div>
              <Kicker plain>{t('subscribe.kicker')}</Kicker>
              <h1 className="display-lg" style={{ marginTop: '1rem' }}>
                {t('subscribe.title')}
              </h1>
            </div>
            <div>
              <p>{t('subscribe.intro')}</p>
              <div className="page-hero__meta">
                <a className="text-link" href="/rss.xml">
                  {t('subscribe.preferRss')} →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {message ? (
        <div className="shell" style={{ paddingTop: '1.5rem' }}>
          <div
            className="flash"
            data-tone={status === 'ok' || status === 'pending' || status === 'exists' ? 'success' : 'error'}
            role="status"
          >
            {message}
          </div>
        </div>
      ) : null}

      <NewsletterBand settings={settings} />

      <div className="shell">
        <div className="about-layout" style={{ paddingTop: 'clamp(2rem, 4vw, 3rem)' }}>
          <div className="about-copy">
            <h2 style={{ marginTop: 0 }}>{t('subscribe.whatHappensTitle')}</h2>
            <p>{t('subscribe.whatHappensBody')}</p>
            <h2>{t('subscribe.privacyTitle')}</h2>
            <p>{t('subscribe.privacyBody')}</p>
          </div>
          <aside className="about-aside">
            <h2>{t('subscribe.otherPaths')}</h2>
            <ul>
              <li>
                <a href="/rss.xml">{t('subscribe.rssFeed')}</a>
              </li>
              <li>
                <a href={href('/articles')}>{t('subscribe.allArticles')}</a>
              </li>
              <li>
                <a href={href('/about')}>{t('subscribe.aboutPublication')}</a>
              </li>
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
  const { t, href } = useI18n()
  return (
    <SiteLayout settings={settings} categories={categories} path="/confirm">
      <section className="page-hero">
        <div className="shell">
          <Kicker plain>{t('subscribe.kicker')}</Kicker>
          <h1 className="display-lg" style={{ marginTop: '1rem' }}>
            {status === 'done' ? t('subscribe.confirmDoneTitle') : t('subscribe.confirmInvalidTitle')}
          </h1>
          <p className="lede" style={{ marginTop: '1.5rem', maxWidth: '46ch' }}>
            {status === 'done' ? t('subscribe.confirmDoneBody') : t('subscribe.confirmInvalidBody')}
          </p>
          <p style={{ marginTop: '1.75rem' }}>
            <a className="btn btn--ghost" href={href('/')}>
              {t('errors.backHome')}
            </a>
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
  const { t, href } = useI18n()
  return (
    <SiteLayout settings={settings} categories={categories} path="/unsubscribe">
      <section className="page-hero">
        <div className="shell">
          <Kicker plain>{t('subscribe.kicker')}</Kicker>
          <h1 className="display-lg" style={{ marginTop: '1rem' }}>
            {status === 'done' ? t('subscribe.unsubscribeDoneTitle') : t('subscribe.unsubscribeInvalidTitle')}
          </h1>
          <p className="lede" style={{ marginTop: '1.5rem', maxWidth: '46ch' }}>
            {status === 'done' ? t('subscribe.unsubscribeDoneBody') : t('subscribe.unsubscribeInvalidBody')}
          </p>
          <p style={{ marginTop: '1.75rem' }}>
            <a className="btn btn--ghost" href={href('/')}>
              {t('errors.backHome')}
            </a>
          </p>
        </div>
      </section>
    </SiteLayout>
  )
}
