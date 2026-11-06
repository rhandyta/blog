import { describe, expect, test } from 'bun:test'
import { createHmac } from 'node:crypto'
import { sendEmailBatch } from '../src/lib/email/mailer'
import { verifyResendWebhook } from '../src/lib/email/webhook'

describe('Resend webhook signatures', () => {
  test('accepts a valid Svix signature and rejects tampering or stale timestamps', () => {
    const secret = `whsec_${Buffer.from('test-webhook-key').toString('base64')}`
    const id = 'msg_test'
    const timestamp = String(Math.floor(Date.now() / 1000))
    const payload = '{"type":"email.delivered"}'
    const signature = createHmac('sha256', Buffer.from('test-webhook-key'))
      .update(`${id}.${timestamp}.${payload}`)
      .digest('base64')

    expect(
      verifyResendWebhook({
        id,
        timestamp,
        signature: `v1,${signature}`,
        payload,
        secret,
      }),
    ).toBe(true)

    expect(
      verifyResendWebhook({
        id,
        timestamp,
        signature: `v1,${signature}`,
        payload: '{"type":"email.bounced"}',
        secret,
      }),
    ).toBe(false)

    expect(
      verifyResendWebhook({
        id,
        timestamp: String(Number(timestamp) - 600),
        signature: `v1,${signature}`,
        payload,
        secret,
      }),
    ).toBe(false)
  })
})

describe('email batch fallback', () => {
  test('reports one result per development message', async () => {
    const results = await sendEmailBatch([
      { to: 'one@example.com', subject: 'One', html: '<p>One</p>', text: 'One' },
      { to: 'two@example.com', subject: 'Two', html: '<p>Two</p>', text: 'Two' },
    ])
    expect(results).toHaveLength(2)
    expect(results.every((result) => result.ok)).toBe(true)
  })
})
