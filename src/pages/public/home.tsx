import type { ArticleCard } from '../../lib/db/queries/articles'
import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
import { formatDate } from '../../lib/content/html'
import { NewsletterBand, SiteLayout } from '../../components/layout'
import {
  ArticleRow,
  Cover,
  Kicker,
  PickLead,
  PickSmall,
  SectionHead,
  TopicRow,
  accentClass,
} from '../../components/ui'

function breakableTitle(title: string) {
  return title.split(/(?<=[a-z])(?=[A-Z])/g).map((part, index) => (
    <span key={`${part}-${index}`}>
      {index > 0 ? <wbr /> : null}
      {part}
    </span>
  ))
}

export function HomeEmptyPage({
  settings,
  categories,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
}) {
  return (
    <SiteLayout settings={settings} categories={categories} path="/">
      <section className="about-hero">
        <div className="shell">
          <Kicker plain>{settings.issue} — A new publication</Kicker>
          <h1 style={{ marginTop: '1.25rem', maxWidth: '16ch' }}>A place for things worth keeping.</h1>
          <p className="lede" style={{ marginTop: '1.5rem', maxWidth: '46ch' }}>
            {settings.description}
          </p>
          <div className="error-page__actions">
            <a className="btn btn--solid" href="/admin/login">Editorial sign in</a>
            <a className="btn btn--ghost" href="/about">About the publication</a>
          </div>
        </div>
      </section>
      <NewsletterBand settings={settings} />
    </SiteLayout>
  )
}

export function HomePage({
  settings,
  categories,
  hero,
  latest,
  picks,
  mostRead,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  hero: ArticleCard
  latest: ArticleCard[]
  picks: ArticleCard[]
  mostRead: ArticleCard[]
}) {
  let section = 1
  const latestNumber = latest.length ? String(section++).padStart(2, '0') : null
  const picksNumber = picks.length ? String(section++).padStart(2, '0') : null
  const mostReadNumber = mostRead.length ? String(section++).padStart(2, '0') : null
  const topicsNumber = String(section++).padStart(2, '0')

  return (
    <SiteLayout settings={settings} categories={categories} path="/">
      <section className={`hero ${accentClass(hero.category?.accent)}`}>
        <div className="shell">
          <div className="hero__grid">
            <div className="hero__text">
              <div>
                <Kicker accent={hero.category?.accent}>{hero.category?.name ?? 'Essay'}</Kicker>
                <span className="meta" style={{ marginLeft: '0.9rem' }}>
                  Featured
                </span>
              </div>
              <h1 className="hero__title display-xl">
                <a href={`/articles/${hero.slug}`}>{breakableTitle(hero.title)}</a>
              </h1>
              <p className="hero__deck deck">{hero.subtitle ?? hero.excerpt}</p>
              <div className="hero__footer">
                <div className="hero__meta">
                  <span className="meta">
                    {hero.author ? (
                      <a className="link-underline" href={`/author/${hero.author.slug}`}>{hero.author.displayName}</a>
                    ) : (
                      'The editors'
                    )}
                  </span>
                  <span className="sep" aria-hidden="true">/</span>
                  <span className="meta">{formatDate(hero.publishedAt, 'long')}</span>
                  <span className="sep" aria-hidden="true">/</span>
                  <span className="meta">{hero.readingMinutes} min read</span>
                </div>
                <a className="text-link" href={`/articles/${hero.slug}`}>
                  Read the essay →
                </a>
              </div>
            </div>
            <div className="hero__media">
              <a href={`/articles/${hero.slug}`} aria-hidden="true" tabIndex={-1}>
                <Cover media={hero.media} aspect="hero" sizes="(min-width: 960px) 42vw, 100vw" priority />
              </a>
              {hero.media?.caption ? <p className="figure-caption">{hero.media.caption}</p> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="intro-band" aria-label="About this publication">
        <div className="shell">
          <div className="intro-band__grid">
            <div>
              <span className="kicker kicker--plain">The publication</span>
            </div>
            <div>
              <p>{settings.intro}</p>
              <p className="meta" style={{ marginTop: '1rem' }}>
                <a className="text-link" href="/about">Read about RhandytaVERSE →</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {latestNumber ? (
        <section className="latest">
          <div className="shell">
            <SectionHead number={latestNumber} label="Latest" moreHref="/articles" moreLabel="All articles" />
            <div>
              {latest.map((card) => (
                <ArticleRow key={card.id} card={card} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {picksNumber ? (
        <section className="picks">
          <div className="shell">
            <SectionHead number={picksNumber} label="Editors’ picks" />
            <div className="picks__grid">
              {picks[0] ? <PickLead card={picks[0]} /> : null}
              <div className="pick__side">
                {picks.slice(1, 4).map((card, index) => (
                  <PickSmall key={card.id} card={card} index={index + 2} />
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {mostReadNumber ? (
        <section className="most-read">
          <div className="shell">
            <SectionHead number={mostReadNumber} label="Most read" moreHref="/articles" moreLabel="The index" />
            <div className="most-read__grid">
              {mostRead.map((card, index) => (
                <a key={card.id} className={`most-read__item ${accentClass(card.category?.accent)}`} href={`/articles/${card.slug}`}>
                  <span className="most-read__rank">{String(index + 1).padStart(2, '0')}</span>
                  <h3>{card.title}</h3>
                  <span className="meta">{card.category?.name} · {card.readingMinutes} min</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="topics">
        <div className="shell">
          <SectionHead number={topicsNumber} label="Topics" moreHref="/topics" moreLabel="All topics" />
          <div className="topic-list">
            {categories.map((category, index) => (
              <TopicRow key={category.id} category={category} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section className="manifesto">
        <div className="shell">
          <div className="manifesto__inner">
            <span className="kicker kicker--plain">A note on method</span>
            <div>
              <blockquote>{settings.manifesto}</blockquote>
              <p className="manifesto__by">— {settings.manifestoBy}</p>
            </div>
          </div>
        </div>
      </section>

      <NewsletterBand settings={settings} />

      <section className="about-strip">
        <div className="shell">
          <div className="about-strip__grid">
            <div>
              <span className="kicker kicker--plain">The person</span>
              <h2 className="display-sm" style={{ marginTop: '1rem' }}>
                {settings.title} is Rhandyta Briantama.
              </h2>
            </div>
            <div>
              {settings.about
                .split(/\n{2,}/)
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p key={index} style={index > 0 ? { marginTop: '1rem' } : undefined}>
                    {paragraph}
                  </p>
                ))}
              <p style={{ marginTop: '1.25rem' }}>
                <a className="text-link" href="/about">More about Rhandyta Briantama →</a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  )
}
