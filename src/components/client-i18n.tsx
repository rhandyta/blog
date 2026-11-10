import type { ClientMessages } from '../lib/i18n/client'

/**
 * Serialises the client copy bundle into a hidden element. React escapes the
 * attribute for us, so the data can never break out of the markup (no raw HTML
 * injection is involved), and the browser script reads it back with
 * `getAttribute`.
 */
export function ClientI18n({ data }: { data: ClientMessages }) {
  return <div hidden data-client-i18n={JSON.stringify(data)} />
}
