import { ACCENTS, getAuthorById, getAuthorBySlug, listAuthors, listCategories, listTags, upsertAuthor } from '../db/queries/taxonomy'
import { createArticle, getArticleById, listRecentArticleTitles, publishArticle, uniqueArticleSlug } from '../db/queries/articles'
import {
  countAiCoversSince,
  countGenerationsSince,
  createRun,
  dueRuns,
  getAutomationSettings,
  latestUnconsumedActivity,
  markActivityConsumed,
  saveAutomationSettings,
  updateRun,
} from '../db/queries/automation'
import { docToText, makeExcerpt, readingMinutes, slugify } from '../content/doc'
import { parseMarkdown } from '../content/markdown'
import { coverAlt, coverSvg } from '../media/cover'
import { saveUpload } from '../media/storage'
import { generateDraft, hasGeminiKey } from './gemini'
import { generateCoverImage } from './image'

export type GenerateResult =
  | {
      ok: true
      articleId: string
      slug: string
      title: string
      kind: 'activity' | 'initiative'
      runId: string
      authorId: string
    }
  | {
      ok: false
      reason: 'disabled' | 'missing-key' | 'limit' | 'no-category' | 'error'
      message?: string
    }

export type DueResult = {
  published: number
  reviewed: number
  skipped: number
  deleted: number
}

export type BatchResult = {
  generated: Array<{
    articleId: string
    title: string
    slug: string
    kind: 'activity' | 'initiative'
    runId: string
  }>
  attempts: number
  errors: string[]
  reason: 'done' | 'limit' | 'time' | 'error' | 'disabled' | 'missing-key' | 'no-category'
}

// A small grace avoids skipping a run that happened exactly 24 hours ago at the
// same cron minute.
export function generationWindowStart(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString()
}

function hashSeed(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return (Math.abs(hash) % 997) + 1
}

async function resolveAuthor(authorId: string | null) {
  if (authorId) {
    const author = await getAuthorById(authorId)
    if (author) return author
  }

  const authors = await listAuthors()
  if (authors[0]) {
    await saveAutomationSettings({ authorId: authors[0].id })
    return authors[0]
  }

  let slug = 'rhandyta'
  let suffix = 2
  while (await getAuthorBySlug(slug)) {
    slug = `rhandyta-${suffix}`
    suffix += 1
  }

  const id = crypto.randomUUID()
  await upsertAuthor({
    id,
    slug,
    displayName: 'Rhandyta',
    roleTitle: 'Editor',
    bio: 'Notes on software, design, and everyday life.',
    longBio:
      'Rhandyta keeps this publication. Essays begin with small observations and work outward from there.',
    expertise: ['software', 'design', 'attention'],
    isDemo: false,
  })

  const author = await getAuthorById(id)
  if (!author) throw new Error('Could not create the default author profile')
  await saveAutomationSettings({ authorId: author.id })
  return author
}

export async function generateAutomationDraft(source: 'manual' | 'cron'): Promise<GenerateResult> {
  const settings = await getAutomationSettings()
  if (!settings.enabled) return { ok: false, reason: 'disabled' }
  if (!hasGeminiKey()) return { ok: false, reason: 'missing-key' }

  const generatedRecently = await countGenerationsSince(generationWindowStart())
  if (generatedRecently >= Math.max(1, settings.dailyLimit)) {
    return { ok: false, reason: 'limit' }
  }

  const activity = await latestUnconsumedActivity()
  const kind: 'activity' | 'initiative' = activity ? 'activity' : 'initiative'

  try {
    const author = await resolveAuthor(settings.authorId)
    const categories = await listCategories()
    if (!categories.length) return { ok: false, reason: 'no-category' }
    const tags = await listTags({ limit: 500 })
    const recentTitles = await listRecentArticleTitles(12)

    const draft = await generateDraft(
      {
        hasActivity: Boolean(activity),
        activityText: activity?.text ?? '',
        imageSrc: activity?.media?.src ?? null,
        language: settings.language,
        authorName: author.displayName,
        authorRole: author.roleTitle,
        authorBio: author.longBio ?? author.bio,
        categories: categories.map((category) => ({
          name: category.name,
          slug: category.slug,
          description: category.description,
        })),
        tags: tags.map((tag) => ({ name: tag.name, slug: tag.slug })),
        initiativeBrief: settings.initiativeBrief,
        recentTitles,
      },
      settings.model,
    )

    const wantedCategory = (draft.category ?? '').toLowerCase()
    const category =
      categories.find(
        (item) =>
          item.slug.toLowerCase() === wantedCategory || item.name.toLowerCase() === wantedCategory,
      ) ?? categories[0]

    const tagIds = [
      ...new Set(
        draft.tags
          .map(
            (name) =>
              tags.find(
                (tag) =>
                  tag.slug.toLowerCase() === name.toLowerCase() ||
                  tag.name.toLowerCase() === name.toLowerCase(),
              )?.id,
          )
          .filter((id): id is string => Boolean(id)),
      ),
    ].slice(0, 4)

    const doc = parseMarkdown(draft.body)
    if (!doc.content?.length) throw new Error('Generated essay body was empty')
    const bodyText = docToText(doc)
    const excerpt = draft.excerpt || makeExcerpt(bodyText, 200)
    const slug = await uniqueArticleSlug(slugify(draft.title))

    let featuredMediaId: string | null = activity?.media?.id ?? null
    let coverSource: 'activity' | 'ai' | 'procedural' = featuredMediaId ? 'activity' : 'procedural'
    let coverError: string | null = null
    const accent = ACCENTS.find((item) => item.token === category.accent)?.hex ?? '#c8452b'

    if (!featuredMediaId && settings.coverMode === 'ai' && settings.aiImageDailyLimit > 0) {
      const aiCovers = await countAiCoversSince(generationWindowStart())
      if (aiCovers < settings.aiImageDailyLimit) {
        try {
          const generated = await generateCoverImage({
            provider: settings.aiImageProvider,
            title: draft.title,
            excerpt,
            categoryName: category.name,
            categoryDescription: category.description,
            accentHex: accent,
            language: settings.language,
            model: settings.aiImageModel,
          })
          const extension = generated.mimeType.includes('webp')
            ? 'webp'
            : generated.mimeType.includes('jpeg') || generated.mimeType.includes('jpg')
              ? 'jpg'
              : 'png'
          const media = await saveUpload(generated.buffer, {
            originalName: `ai-cover-${slug}.${extension}`,
            alt: `Editorial cover for ${draft.title}`,
            caption: null,
            uploadedBy: null,
            allowSvg: false,
          })
          if (media) {
            featuredMediaId = media.id
            coverSource = 'ai'
          } else {
            coverError = 'AI image could not be stored'
          }
        } catch (error) {
          coverError = error instanceof Error ? error.message : String(error)
          console.warn('[automation] AI cover failed, using procedural fallback:', coverError)
        }
      }
    }

    if (!featuredMediaId) {
      const seed = hashSeed(draft.title)
      const media = await saveUpload(Buffer.from(coverSvg(seed, accent)), {
        originalName: `automation-cover-${slug}.svg`,
        alt: coverAlt(seed),
        caption: null,
        uploadedBy: null,
        allowSvg: true,
      })
      featuredMediaId = media?.id ?? null
      coverSource = 'procedural'
    }

    const now = new Date().toISOString()
    const autoPublishAt = settings.autoPublish
      ? new Date(Date.now() + Math.max(1, settings.autoPublishDelayHours) * 60 * 60 * 1000).toISOString()
      : null

    const article = await createArticle({
      id: crypto.randomUUID(),
      slug,
      title: draft.title,
      subtitle: draft.subtitle,
      excerpt,
      bodyJson: JSON.stringify(doc),
      bodyText,
      readingMinutes: readingMinutes(bodyText),
      status: 'draft',
      authorId: author.id,
      categoryId: category.id,
      featuredMediaId,
      featuredCaption: null,
      isFeatured: false,
      featuredRank: null,
      isEditorsPick: false,
      seoTitle: draft.title,
      seoDescription: draft.seoDescription || excerpt,
      canonicalUrl: null,
      ogMediaId: null,
      noIndex: false,
      isDemo: false,
      publishedAt: null,
      scheduledFor: null,
      tagIds,
    })

    if (!article) throw new Error('Could not create the draft article')

    const run = await createRun({
      source,
      kind,
      activityId: activity?.id ?? null,
      articleId: article.id,
      status: 'pending',
      coverSource,
      coverError,
      autoPublishAt,
    })

    if (activity) await markActivityConsumed(activity.id)
    await saveAutomationSettings({ lastRunAt: now })

    return {
      ok: true,
      articleId: article.id,
      slug: article.slug,
      title: article.title,
      kind,
      runId: run.id,
      authorId: author.id,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await createRun({
      source,
      kind,
      activityId: activity?.id ?? null,
      articleId: null,
      status: 'error',
      error: message,
      autoPublishAt: null,
    }).catch(() => undefined)
    return { ok: false, reason: 'error', message }
  }
}

export async function generateAutomationBatch(
  source: 'manual' | 'cron',
  options: { max?: number; budgetMs?: number; generate?: typeof generateAutomationDraft } = {},
): Promise<BatchResult> {
  const settings = await getAutomationSettings()
  const result: BatchResult = { generated: [], attempts: 0, errors: [], reason: 'done' }
  const generateOne = options.generate ?? generateAutomationDraft

  if (!settings.enabled) {
    result.reason = 'disabled'
    return result
  }
  if (!options.generate && !hasGeminiKey()) {
    result.reason = 'missing-key'
    return result
  }

  const startedAt = Date.now()
  const budgetMs = options.budgetMs ?? 210_000
  const max = Math.min(options.max ?? settings.dailyLimit, settings.dailyLimit)

  while (result.attempts < max) {
    if (Date.now() - startedAt >= budgetMs) {
      result.reason = 'time'
      break
    }

    const alreadyGenerated = await countGenerationsSince(generationWindowStart())
    if (alreadyGenerated >= settings.dailyLimit) {
      result.reason = 'limit'
      break
    }

    const single = await generateOne(source)
    result.attempts += 1

    if (!single.ok) {
      result.reason = single.reason
      if (single.message) result.errors.push(single.message)
      break
    }

    result.generated.push({
      articleId: single.articleId,
      title: single.title,
      slug: single.slug,
      kind: single.kind,
      runId: single.runId,
    })
  }

  return result
}

export async function processDueAutomation(now = new Date().toISOString()): Promise<DueResult> {
  const runs = await dueRuns(now)
  const result: DueResult = { published: 0, reviewed: 0, skipped: 0, deleted: 0 }

  for (const run of runs) {
    if (!run.articleId) {
      await updateRun(run.id, { status: 'skipped' })
      result.skipped += 1
      continue
    }

    const article = await getArticleById(run.articleId)
    if (!article) {
      await updateRun(run.id, { status: 'deleted' })
      result.deleted += 1
      continue
    }
    if (article.status === 'published') {
      await updateRun(run.id, { status: 'published' })
      result.published += 1
      continue
    }
    if (article.status !== 'draft') {
      await updateRun(run.id, { status: 'skipped' })
      result.skipped += 1
      continue
    }
    if (article.updatedAt !== article.createdAt) {
      await updateRun(run.id, { status: 'reviewed' })
      result.reviewed += 1
      continue
    }

    const published = await publishArticle(article.id)
    if (published) {
      await updateRun(run.id, { status: 'published' })
      result.published += 1
    } else {
      await updateRun(run.id, { status: 'error', error: 'Auto-publish failed' })
    }
  }

  return result
}

export async function runAutomationCron(): Promise<DueResult & { generated: BatchResult }> {
  const due = await processDueAutomation()
  const generated = await generateAutomationBatch('cron')
  return { ...due, generated }
}
