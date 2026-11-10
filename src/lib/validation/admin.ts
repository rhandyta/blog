import { z } from 'zod'

export const ACCENT_TOKENS = ['vermilion', 'indigo', 'ultramarine', 'ochre', 'teal', 'plum', 'moss', 'clay'] as const

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
})

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(200).optional(),
  intro: z.string().trim().max(400).optional(),
  accent: z.enum(ACCENT_TOKENS).optional(),
  sortOrder: z.coerce.number().int().min(0).max(99).optional(),
})

export const tagInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(200).optional(),
})

export const authorInputSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  slug: z.string().trim().max(80).optional(),
  roleTitle: z.string().trim().max(60).optional(),
  bio: z.string().trim().max(300).optional(),
  longBio: z.string().trim().max(2000).optional(),
  expertise: z.string().max(300).optional(),
  website: z.string().trim().max(300).optional(),
})

export const settingsInputSchema = z.object({
  title: z.string().trim().min(1).max(60),
  issue: z.string().trim().max(40),
  tagline: z.string().trim().max(120),
  description: z.string().trim().max(300),
  intro: z.string().trim().max(500),
  manifesto: z.string().trim().max(300),
  manifestoBy: z.string().trim().max(60),
  about: z.string().trim().max(6000),
  newsletterTitle: z.string().trim().max(120),
  newsletterBlurb: z.string().trim().max(400),
  email: z.string().trim().max(200),
  x: z.string().trim().max(300),
  github: z.string().trim().max(300),
  linkedin: z.string().trim().max(300),
  siteLanguage: z.enum(['id', 'en']),
})

export const articlePayloadSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(300).nullable().optional(),
  excerpt: z.string().trim().max(600).nullable().optional(),
  slug: z.string().trim().max(120).nullable().optional(),
  body: z.unknown(),
  categoryId: z.string().nullable().optional(),
  authorId: z.string().nullable().optional(),
  featuredMediaId: z.string().nullable().optional(),
  featuredCaption: z.string().max(300).nullable().optional(),
  ogMediaId: z.string().nullable().optional(),
  isFeatured: z.boolean().optional(),
  featuredRank: z.number().int().min(0).max(99).nullable().optional(),
  isEditorsPick: z.boolean().optional(),
  seoTitle: z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(400).nullable().optional(),
  canonicalUrl: z.string().max(500).nullable().optional(),
  noIndex: z.boolean().optional(),
  language: z.enum(['id', 'en']).nullable().optional(),
  tagIds: z.array(z.string()).max(30).optional(),
  status: z.enum(['draft', 'published']).optional(),
  updatedAt: z.string().nullable().optional(),
})

export const scheduleSchema = z.object({
  scheduledFor: z.string().min(1),
})

export const automationSettingsSchema = z.object({
  enabled: z.boolean(),
  language: z.string().trim().min(2).max(40),
  model: z.string().trim().min(1).max(80),
  authorId: z.string().trim().max(80).nullable(),
  autoPublish: z.boolean(),
  autoPublishDelayHours: z.coerce.number().int().min(1).max(168),
  dailyLimit: z.coerce.number().int().min(1).max(10),
  coverMode: z.enum(['procedural', 'ai']),
  aiImageProvider: z.enum(['gemini', 'cloudflare']),
  aiImageModel: z.string().trim().min(1).max(100),
  aiImageDailyLimit: z.coerce.number().int().min(0).max(10),
  initiativeBrief: z.string().trim().max(2000),
})

export const mediaPatchSchema = z.object({
  alt: z.string().trim().max(300).optional(),
  caption: z.string().trim().max(400).nullable().optional(),
  originalName: z.string().trim().max(200).optional(),
})

export const USER_ROLES = ['admin', 'editor', 'author'] as const

export const accountProfileSchema = z.object({
  name: z.string().trim().min(1).max(80),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(200),
    confirmPassword: z.string().min(1),
    revokeOthers: z.boolean().optional(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
  })

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  role: z.enum(USER_ROLES),
  createAuthor: z.boolean().optional(),
})

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  role: z.enum(USER_ROLES),
  active: z.boolean(),
  authorId: z.string().trim().max(80).nullable().optional(),
})

export const adminResetPasswordSchema = z
  .object({
    newPassword: z.string().min(8).max(200),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
  })

export function validHttpUrl(value: string): boolean {
  if (!value) return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function parseScheduleDate(value: string): string | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}
