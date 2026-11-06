import { z } from 'zod'

const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional(),
)

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PUBLIC_ORIGIN: z.string().url().default('http://localhost:3000'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().min(1).default('./data/commonplace.db'),
  UPLOAD_DIR: z.string().min(1).default('./data/uploads'),
  SESSION_SECRET: z.string().min(16).default('dev-secret-not-for-production-use'),
  ADMIN_EMAIL: z.string().email().default('editor@rhandytaverse.local'),
  ADMIN_PASSWORD: z.string().min(8).default('rhandytaverse-dev'),
  SITE_NAME: z.string().min(1).default('RhandytaVERSE'),
  DISABLE_SCHEDULER: optionalString,
  CRON_SECRET: optionalString,
  TURSO_DATABASE_URL: optionalString,
  TURSO_AUTH_TOKEN: optionalString,
  BLOB_READ_WRITE_TOKEN: optionalString,
  GEMINI_API_KEY: optionalString,
  GEMINI_MODEL: optionalString,
  CLOUDFLARE_ACCOUNT_ID: optionalString,
  CLOUDFLARE_API_TOKEN: optionalString,
  RESEND_API_KEY: optionalString,
  NEWSLETTER_FROM: optionalString,
  NEWSLETTER_REPLY_TO: optionalString,
})

export type AppConfig = z.infer<typeof envSchema>

let cached: AppConfig | undefined

function defaultOrigin(): string | undefined {
  const host =
    process.env.VERCEL_ENV === 'preview'
      ? process.env.VERCEL_URL
      : process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  return host ? `https://${host.replace(/^https?:\/\//, '')}` : undefined
}

export function getConfig(): AppConfig {
  if (!cached) {
    if (process.argv.includes('--prod')) {
      process.env.NODE_ENV = 'production'
    }
    const env = {
      ...process.env,
      ...(process.env.PUBLIC_ORIGIN ? {} : defaultOrigin() ? { PUBLIC_ORIGIN: defaultOrigin() } : {}),
    }
    const parsed = envSchema.safeParse(env)
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ')
      throw new Error(`Invalid environment configuration — ${issues}`)
    }
    if (
      parsed.data.NODE_ENV === 'production' &&
      /^(dev-secret|change-me)/i.test(parsed.data.SESSION_SECRET)
    ) {
      throw new Error('SESSION_SECRET must be set to a unique value in production')
    }
    cached = parsed.data
  }
  return cached
}

export function resetConfigCache(): void {
  cached = undefined
}

export function isProd(): boolean {
  return getConfig().NODE_ENV === 'production'
}

export function isRemoteDatabase(): boolean {
  return Boolean(getConfig().TURSO_DATABASE_URL)
}

export function isBlobStorage(): boolean {
  return Boolean(getConfig().BLOB_READ_WRITE_TOKEN)
}
