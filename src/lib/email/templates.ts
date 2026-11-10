import { escapeHtml, splitParagraphs } from '../content/html'
import { DEFAULT_LOCALE, LOCALE_META, getTranslator, localizedPath, type Locale } from '../i18n'

function shell(input: { siteTitle: string; title: string; body: string; footer: string; lang: string }): string {
  return `<!doctype html>
<html lang="${escapeHtml(input.lang)}">
  <body style="margin:0;padding:0;background:#f6f2e9;color:#17140f;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f2e9;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fbf7ef;border:1px solid #d8cfbf;">
            <tr>
              <td style="padding:28px 32px 0;">
                <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#7c7364;">
                  ${escapeHtml(input.siteTitle)}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 0;">
                <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.1;font-weight:500;letter-spacing:-0.02em;color:#17140f;">
                  ${escapeHtml(input.title)}
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 32px;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.65;color:#3f382e;">
                ${input.body}
                <div style="margin-top:28px;padding-top:18px;border-top:1px solid #d8cfbf;font-family:'Courier New',monospace;font-size:11px;line-height:1.7;letter-spacing:0.04em;color:#7c7364;">
                  ${input.footer}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function paragraphs(text: string): string {
  return splitParagraphs(text)
    .map((paragraph) => `<p style="margin:0 0 1em;">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** Absolute link to a localized page, used inside emails. */
function localizedUrl(origin: string, locale: Locale, path: string): string {
  return `${origin.replace(/\/$/, '')}${localizedPath(locale, path)}`
}

export function confirmationEmail(input: { siteTitle: string; origin: string; token: string; locale?: Locale }): {
  subject: string
  html: string
  text: string
} {
  const locale = input.locale ?? DEFAULT_LOCALE
  const t = getTranslator(locale)
  const confirmUrl = localizedUrl(input.origin, locale, `/confirm?token=${encodeURIComponent(input.token)}`)
  const subject = t('mail.confirmSubject', { site: input.siteTitle })
  const body = `
    <p style="margin:0 0 1em;">${escapeHtml(t('mail.confirmIntro', { site: input.siteTitle }))}</p>
    <p style="margin:0 0 1.4em;">
      <a href="${escapeHtml(confirmUrl)}" style="display:inline-block;background:#17140f;color:#f6f2e9;text-decoration:none;padding:12px 18px;font-family:'Courier New',monospace;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(t('mail.confirmButton'))}</a>
    </p>
    <p style="margin:0;font-size:14px;color:#7c7364;">${escapeHtml(t('mail.confirmIgnore'))}</p>`
  return {
    subject,
    html: shell({
      siteTitle: input.siteTitle,
      title: t('mail.confirmTitle'),
      body,
      lang: LOCALE_META[locale].htmlLang,
      footer: `${escapeHtml(t('mail.confirmFallback'))}<br><a href="${escapeHtml(confirmUrl)}" style="color:#7c7364;">${escapeHtml(confirmUrl)}</a>`,
    }),
    text: `${t('mail.confirmText', { site: input.siteTitle })}\n\n${t('mail.confirmTextIntro', { site: input.siteTitle })}\n${confirmUrl}\n\n${t('mail.confirmIgnore')}`,
  }
}

export function digestEmail(input: {
  siteTitle: string
  origin: string
  subject: string
  intro: string
  locale?: Locale
  articles: Array<{
    slug: string
    title: string
    excerpt: string
    readingMinutes: number
    categoryName: string | null
    readers: number
    views: number
  }>
  unsubscribeUrl: string
}): { subject: string; html: string; text: string } {
  const locale = input.locale ?? DEFAULT_LOCALE
  const t = getTranslator(locale)
  const items = input.articles
    .map((article, index) => {
      const url = localizedUrl(input.origin, locale, `/articles/${article.slug}`)
      return `
        <div style="padding:20px 0;border-top:1px solid #d8cfbf;">
          <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#7c7364;">
            ${String(index + 1).padStart(2, '0')} · ${escapeHtml(article.categoryName ?? t('common.essay'))} · ${escapeHtml(t('mail.minRead', { count: article.readingMinutes }))}
          </div>
          <h2 style="margin:8px 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.2;font-weight:500;">
            <a href="${escapeHtml(url)}" style="color:#17140f;text-decoration:none;">${escapeHtml(article.title)}</a>
          </h2>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.55;color:#4b453b;">${escapeHtml(article.excerpt)}</p>
          <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#7c7364;">
            ${escapeHtml(t('mail.readers', { count: article.readers }))} · ${escapeHtml(t('mail.views', { count: article.views }))}
          </div>
          <p style="margin:10px 0 0;">
            <a href="${escapeHtml(url)}" aria-label="${escapeHtml(t('mail.digestReadAria', { title: article.title }))}" style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#17140f;">${escapeHtml(t('mail.digestRead'))} →</a>
          </p>
        </div>`
    })
    .join('')
  const footer = `${escapeHtml(t('mail.digestFooter', { site: input.siteTitle }))}<br><a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#7c7364;">${escapeHtml(t('mail.unsubscribe'))}</a>`
  return {
    subject: input.subject,
    html: shell({
      siteTitle: input.siteTitle,
      title: input.subject,
      body: `<p style="margin:0 0 1.2em;">${escapeHtml(input.intro)}</p>${items}`,
      lang: LOCALE_META[locale].htmlLang,
      footer,
    }),
    text: `${input.subject}\n\n${input.intro}\n\n${input.articles
      .map(
        (article) =>
          `${article.title}\n${localizedUrl(input.origin, locale, `/articles/${article.slug}`)}\n${t('mail.readers', { count: article.readers })} · ${t('mail.views', { count: article.views })}\n${article.excerpt}`,
      )
      .join(
        '\n\n',
      )}\n\n${t('mail.digestTextFooter', { site: input.siteTitle })}\n${t('mail.unsubscribe')}: ${input.unsubscribeUrl}`,
  }
}

export function newsletterEmail(input: {
  siteTitle: string
  origin: string
  subject: string
  body: string
  unsubscribeUrl: string
  locale?: Locale
}): { subject: string; html: string; text: string } {
  const locale = input.locale ?? DEFAULT_LOCALE
  const t = getTranslator(locale)
  const footer = `${escapeHtml(t('mail.digestFooter', { site: input.siteTitle }))}<br><a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#7c7364;">${escapeHtml(t('mail.unsubscribe'))}</a>`
  return {
    subject: input.subject,
    html: shell({
      siteTitle: input.siteTitle,
      title: input.subject,
      body: paragraphs(input.body),
      lang: LOCALE_META[locale].htmlLang,
      footer,
    }),
    text: `${input.subject}\n\n${input.body.trim()}\n\n${t('mail.digestTextFooter', { site: input.siteTitle })}\n${t('mail.unsubscribe')}: ${input.unsubscribeUrl}`,
  }
}
