import { describe, expect, test } from 'bun:test'
import { run } from '../src/lib/db/client'
import {
  confirmSubscriber,
  csvCell,
  listSubscribers,
  subscribeEmail,
  unsubscribeByToken,
} from '../src/lib/db/queries/subscribers'

describe('subscriber CSV export', () => {
  test('quotes ordinary values', () => {
    expect(csvCell('reader@example.com')).toBe('"reader@example.com"')
  })

  test('escapes embedded quotes', () => {
    expect(csvCell('a"b@example.com')).toBe('"a""b@example.com"')
  })

  test('neutralises spreadsheet formula injection', () => {
    expect(csvCell('=cmd@example.com')).toBe("\"'=cmd@example.com\"")
    expect(csvCell('+cmd@example.com')).toBe("\"'+cmd@example.com\"")
    expect(csvCell('-cmd@example.com')).toBe("\"'-cmd@example.com\"")
    expect(csvCell('@cmd@example.com')).toBe("\"'@cmd@example.com\"")
  })
})

describe('double opt-in', () => {
  test('holds a pending subscriber until the token is confirmed, then unsubscribes', async () => {
    const email = 'double-opt-in@example.com'
    try {
      const outcome = await subscribeEmail(email, {
        requireConfirmation: true,
        ip: '203.0.113.9',
        source: 'test',
      })
      expect(outcome.result).toBe('pending')
      if (outcome.result !== 'pending') return

      const pending = (await listSubscribers({ q: email })).items[0]
      expect(pending?.confirmedAt).toBeNull()
      expect(pending?.ipHash).toMatch(/^[a-f0-9]{32}$/)
      expect(pending?.confirmationToken).toBe(outcome.token)

      expect(await confirmSubscriber(outcome.token)).toBe(email)
      const confirmed = (await listSubscribers({ q: email })).items[0]
      expect(confirmed?.confirmedAt).toBeTruthy()
      expect(confirmed?.confirmationToken).toBeNull()

      expect(await unsubscribeByToken(confirmed?.unsubscribeToken ?? '')).toBe(email)
      const unsubscribed = (await listSubscribers({ q: email })).items[0]
      expect(unsubscribed?.status).toBe('unsubscribed')
    } finally {
      await run('DELETE FROM subscribers WHERE email = ?', [email])
    }
  })
})
