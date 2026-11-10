import type { ZodIssue } from 'zod'
import type { Translate, TranslationKey } from '../i18n'

/**
 * Zod schemas stay language-neutral: they describe *what* failed, and this
 * mapping turns the issue into a message in the request's language. Nothing
 * translated is ever baked into a schema, so a language switch applies to the
 * next validation pass immediately.
 */
const FIELD_KEYS: Record<string, TranslationKey> = {
  name: 'validation.field.name',
  email: 'validation.field.email',
  password: 'validation.field.password',
  currentPassword: 'validation.field.currentPassword',
  newPassword: 'validation.field.newPassword',
  confirmPassword: 'validation.field.confirmPassword',
  title: 'validation.field.title',
  subtitle: 'validation.field.subtitle',
  excerpt: 'validation.field.excerpt',
  slug: 'validation.field.slug',
  body: 'validation.field.body',
  categoryId: 'validation.field.categoryId',
  authorId: 'validation.field.authorId',
  featuredMediaId: 'validation.field.featuredMediaId',
  ogMediaId: 'validation.field.ogMediaId',
  featuredCaption: 'validation.field.featuredCaption',
  seoTitle: 'validation.field.seoTitle',
  seoDescription: 'validation.field.seoDescription',
  canonicalUrl: 'validation.field.canonicalUrl',
  language: 'validation.field.language',
  tagIds: 'validation.field.tagIds',
  status: 'validation.field.status',
  scheduledFor: 'validation.field.scheduledFor',
  description: 'validation.field.description',
  intro: 'validation.field.intro',
  accent: 'validation.field.accent',
  sortOrder: 'validation.field.sortOrder',
  displayName: 'validation.field.displayName',
  roleTitle: 'validation.field.roleTitle',
  bio: 'validation.field.bio',
  longBio: 'validation.field.longBio',
  expertise: 'validation.field.expertise',
  website: 'validation.field.website',
  issue: 'validation.field.issue',
  tagline: 'validation.field.tagline',
  manifesto: 'validation.field.manifesto',
  manifestoBy: 'validation.field.manifestoBy',
  about: 'validation.field.about',
  newsletterTitle: 'validation.field.newsletterTitle',
  newsletterBlurb: 'validation.field.newsletterBlurb',
  x: 'validation.field.x',
  github: 'validation.field.github',
  linkedin: 'validation.field.linkedin',
  siteLanguage: 'validation.field.siteLanguage',
  role: 'validation.field.role',
  active: 'validation.field.active',
  alt: 'validation.field.alt',
  caption: 'validation.field.caption',
  originalName: 'validation.field.originalName',
  enabled: 'validation.field.enabled',
  model: 'validation.field.model',
  autoPublish: 'validation.field.autoPublish',
  autoPublishDelayHours: 'validation.field.autoPublishDelayHours',
  dailyLimit: 'validation.field.dailyLimit',
  coverMode: 'validation.field.coverMode',
  aiImageProvider: 'validation.field.aiImageProvider',
  aiImageModel: 'validation.field.aiImageModel',
  aiImageDailyLimit: 'validation.field.aiImageDailyLimit',
  initiativeBrief: 'validation.field.initiativeBrief',
  revokeOthers: 'validation.field.revokeOthers',
}

function fieldLabel(t: Translate, path: Array<string | number>): string {
  const raw = String(path[0] ?? '')
  const key = FIELD_KEYS[raw]
  if (key) return t(key)
  return raw || t('validation.generic')
}

export function formatZodIssue(t: Translate, issue: ZodIssue): string {
  const field = fieldLabel(t, issue.path)
  switch (issue.code) {
    case 'invalid_string': {
      const validation = (issue as { validation?: string }).validation
      if (validation === 'email') return t('validation.invalidEmail')
      if (validation === 'url') return t('validation.invalidUrl')
      return t('validation.invalidType', { field })
    }
    case 'too_small':
      if (issue.type === 'string' || typeof issue.minimum === 'number') {
        return t('validation.tooShort', { field, min: Number(issue.minimum) })
      }
      return t('validation.invalidType', { field })
    case 'too_big':
      return t('validation.tooLong', { field, max: Number(issue.maximum) })
    case 'invalid_enum_value':
      return t('validation.invalidOption', { field })
    case 'invalid_type':
      return t('validation.invalidType', { field })
    case 'invalid_date':
      return t('validation.invalidDate')
    case 'not_finite':
      return t('validation.invalidNumber', { field })
    case 'custom':
      // `.refine()` issues carry no message any more; the path identifies them.
      if (String(issue.path[0] ?? '') === 'confirmPassword') return t('validation.passwordMismatch')
      return t('validation.generic')
    default:
      return t('validation.generic')
  }
}

export function formatZodIssues(t: Translate, issues: ZodIssue[]): string[] {
  return issues.map((issue) => formatZodIssue(t, issue))
}
