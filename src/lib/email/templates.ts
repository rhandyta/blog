import { escapeHtml, splitParagraphs } from '../content/html'

function shell(input: {
  siteTitle: string
  title: string
  body: string
  footer: string
}): string {
  return `<!doctype html>
<html>
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

export function confirmationEmail(input: {
  siteTitle: string
  origin: string
  token: string
}): { subject: string; html: string; text: string } {
  const confirmUrl = `${input.origin.replace(/\/$/, '')}/confirm?token=${encodeURIComponent(input.token)}`
  const subject = `Confirm your subscription to ${input.siteTitle}`
  const body = `
    <p style="margin:0 0 1em;">You asked to receive letters from ${escapeHtml(input.siteTitle)}. Confirm your address to join the list.</p>
    <p style="margin:0 0 1.4em;">
      <a href="${escapeHtml(confirmUrl)}" style="display:inline-block;background:#17140f;color:#f6f2e9;text-decoration:none;padding:12px 18px;font-family:'Courier New',monospace;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Confirm subscription</a>
    </p>
    <p style="margin:0;font-size:14px;color:#7c7364;">If you did not request this, you can ignore this email. The link expires in seven days.</p>`
  return {
    subject,
    html: shell({
      siteTitle: input.siteTitle,
      title: 'Confirm your subscription',
      body,
      footer: `If the button does not work, open this address:<br><a href="${escapeHtml(confirmUrl)}" style="color:#7c7364;">${escapeHtml(confirmUrl)}</a>`,
    }),
    text: `Confirm your subscription to ${input.siteTitle}\n\nYou asked to receive letters from ${input.siteTitle}. Confirm your address:\n${confirmUrl}\n\nIf you did not request this, ignore this email. The link expires in seven days.`,
  }
}

export function digestEmail(input: {
  siteTitle: string
  origin: string
  subject: string
  intro: string
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
  const base = input.origin.replace(/\/$/, '')
  const items = input.articles
    .map((article, index) => {
      const url = `${base}/articles/${article.slug}`
      return `
        <div style="padding:20px 0;border-top:1px solid #d8cfbf;">
          <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#7c7364;">
            ${String(index + 1).padStart(2, '0')} · ${escapeHtml(article.categoryName ?? 'Essay')} · ${article.readingMinutes} min read
          </div>
          <h2 style="margin:8px 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.2;font-weight:500;">
            <a href="${escapeHtml(url)}" style="color:#17140f;text-decoration:none;">${escapeHtml(article.title)}</a>
          </h2>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.55;color:#4b453b;">${escapeHtml(article.excerpt)}</p>
          <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#7c7364;">
            ${article.readers} reader${article.readers === 1 ? '' : 's'} · ${article.views} view${article.views === 1 ? '' : 's'}
          </div>
          <p style="margin:10px 0 0;">
            <a href="${escapeHtml(url)}" style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#17140f;">Read the piece →</a>
          </p>
        </div>`
    })
    .join('')
  const footer = `You are receiving this because you subscribed to ${escapeHtml(input.siteTitle)}.<br><a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#7c7364;">Unsubscribe</a>`
  return {
    subject: input.subject,
    html: shell({
      siteTitle: input.siteTitle,
      title: input.subject,
      body: `<p style="margin:0 0 1.2em;">${escapeHtml(input.intro)}</p>${items}`,
      footer,
    }),
    text: `${input.subject}\n\n${input.intro}\n\n${input.articles
      .map(
        (article, index) =>
          `${index + 1}. ${article.title}\n${base}/articles/${article.slug}\n${article.readers} readers · ${article.views} views\n${article.excerpt}`,
      )
      .join('\n\n')}\n\nYou are receiving this because you subscribed to ${input.siteTitle}.\nUnsubscribe: ${input.unsubscribeUrl}`,
  }
}

export function newsletterEmail(input: {
  siteTitle: string
  origin: string
  subject: string
  body: string
  unsubscribeUrl: string
}): { subject: string; html: string; text: string } {
  const footer = `You are receiving this because you subscribed to ${escapeHtml(input.siteTitle)}.<br><a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#7c7364;">Unsubscribe</a>`
  return {
    subject: input.subject,
    html: shell({
      siteTitle: input.siteTitle,
      title: input.subject,
      body: paragraphs(input.body),
      footer,
    }),
    text: `${input.subject}\n\n${input.body.trim()}\n\nYou are receiving this because you subscribed to ${input.siteTitle}.\nUnsubscribe: ${input.unsubscribeUrl}`,
  }
}
