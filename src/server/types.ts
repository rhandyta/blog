import type { Session, User } from '../lib/db/schema'

export type AppEnv = {
  Variables: {
    user: User | null
    session: Session | null
    requestId: string
  }
}
