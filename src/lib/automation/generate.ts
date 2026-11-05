import { ACCENTS, getAuthorById, getAuthorBySlug, listAuthors, listCategories, listTags, upsertAuthor } from '../db/queries/taxonomy'
import { createArticle, getArticleById, publishArticle, uniqueArticleSlug } from '../db/queries/articles'
import {
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

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const generatedRecently = await countGenerationsSince(since)
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

    let featuredMediaId = activity?.media?.id ?? null
    if (!featuredMediaId) {
      const accent = ACCENTS.find((item) => item.token === category.accent)?.hex ?? '#c8452b'
      const seed = hashSeed(draft.title)
      const media = await saveUpload(Buffer.from(coverSvg(seed, accent)), {
        originalName: `automation-cover-${slug}.svg`,
        alt: coverAlt(seed),
        caption: null,
        uploadedBy: null,
        allowSvg: true,
      })
      featuredMediaId = media?.id ?? null
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

export async function runAutomationCron(): Promise<DueResult & { generated: GenerateResult }> {
  const due = await processDueAutomation()
  const generated = await generateAutomationDraft('cron')
  return { ...due, generated }
}
