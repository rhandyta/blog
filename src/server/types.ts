import type { Locale } from '../lib/i18n'
import type { Translate } from '../lib/i18n'
import type { Session, User } from '../lib/db/schema'

export type AppEnv = {
  Variables: {
    user: User | null
    session: Session | null
    requestId: string
    /** Negotiated language for this request. Never stored globally. */
    locale: Locale
    /** Translator bound to `locale`, safe for concurrent requests. */
    t: Translate
    /** Request path with any locale prefix removed. */
    localPath: string
  }
}
