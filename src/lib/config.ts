import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PUBLIC_ORIGIN: z.string().url().default('http://localhost:3000'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().min(1).default('./data/commonplace.db'),
  UPLOAD_DIR: z.string().min(1).default('./data/uploads'),
  SESSION_SECRET: z.string().min(16).default('dev-secret-not-for-production-use'),
  ADMIN_EMAIL: z.string().email().default('editor@commonplace.local'),
  ADMIN_PASSWORD: z.string().min(8).default('commonplace-dev'),
  SITE_NAME: z.string().min(1).default('Commonplace'),
  DISABLE_SCHEDULER: z.string().optional(),
})

export type AppConfig = z.infer<typeof envSchema>

let cached: AppConfig | undefined

export function getConfig(): AppConfig {
  if (!cached) {
    if (process.argv.includes('--prod')) {
      process.env.NODE_ENV = 'production'
    }
    const parsed = envSchema.safeParse(process.env)
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
