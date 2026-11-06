import { getConfig, isProd } from '../config'

export type EmailMessage = {
  to: string
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
}

export type EmailResult = { ok: true; id: string } | { ok: false; error: string }

export function emailConfigured(): boolean {
  return Boolean(getConfig().RESEND_API_KEY)
}

export function newsletterFrom(): string {
  const config = getConfig()
  if (config.NEWSLETTER_FROM) return config.NEWSLETTER_FROM
  const host = new URL(config.PUBLIC_ORIGIN).hostname
  return `RhandytaVERSE <letters@${host}>`
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const config = getConfig()
  if (!config.RESEND_API_KEY) {
    if (!isProd()) {
      console.info(`[email:dev] ${message.subject} → ${message.to}\n${message.text}`)
      return { ok: true, id: 'development' }
    }
    return { ok: false, error: 'Email is not configured.' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: newsletterFrom(),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(config.NEWSLETTER_REPLY_TO ? { reply_to: config.NEWSLETTER_REPLY_TO } : {}),
        ...(message.headers ? { headers: message.headers } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const payload = (await response.json().catch(() => ({}))) as {
      id?: string
      message?: string
      error?: string
    }
    if (!response.ok) {
      return { ok: false, error: payload.message ?? payload.error ?? `Resend returned ${response.status}.` }
    }
    return { ok: true, id: payload.id ?? 'sent' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Email delivery failed.' }
  }
}
