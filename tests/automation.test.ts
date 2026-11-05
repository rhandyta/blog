import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { extractJson } from '../src/lib/automation/gemini'
import { processDueAutomation } from '../src/lib/automation/generate'
import { getDb } from '../src/lib/db/client'
import { articles } from '../src/lib/db/schema'
import { createArticle, deleteArticle, getArticleById } from '../src/lib/db/queries/articles'
import { createRun } from '../src/lib/db/queries/automation'
import { deleteAuthor, deleteCategory, upsertAuthor, upsertCategory } from '../src/lib/db/queries/taxonomy'

const body = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'A short automation fixture article for the scheduled publishing test.' }],
    },
  ],
}

async function createDraft(id: string, slug: string): Promise<void> {
  await createArticle({
    id,
    slug,
    title: `Automation fixture ${slug}`,
    subtitle: null,
    excerpt: 'A fixture used by the automation tests.',
    bodyJson: JSON.stringify(body),
    bodyText: 'A short automation fixture article for the scheduled publishing test.',
    readingMinutes: 1,
    status: 'draft',
    authorId: 'author_auto_test',
    categoryId: 'cat_auto_test',
    featuredMediaId: null,
    featuredCaption: null,
    isFeatured: false,
    featuredRank: null,
    isEditorsPick: false,
    seoTitle: null,
    seoDescription: null,
    canonicalUrl: null,
    ogMediaId: null,
    noIndex: false,
    isDemo: false,
    publishedAt: null,
    scheduledFor: null,
    tagIds: [],
  })
}

describe('automation helpers', () => {
  test('extractJson unwraps fenced JSON', () => {
    const parsed = JSON.parse(extractJson('```json\n{"title":"Test"}\n```')) as { title: string }
    expect(parsed.title).toBe('Test')
  })
})

describe('automation auto-publish', () => {
  beforeAll(async () => {
    await upsertCategory({
      id: 'cat_auto_test',
      slug: 'auto-test',
      name: 'Auto Test',
      description: '',
      intro: '',
      accent: 'teal',
      sortOrder: 99,
    })
    await upsertAuthor({
      id: 'author_auto_test',
      slug: 'auto-test-author',
      displayName: 'Auto Test Author',
      bio: '',
      expertise: [],
    })
  })

  afterAll(async () => {
    await deleteArticle('art_auto_untouched')
    await deleteArticle('art_auto_edited')
    await deleteAuthor('author_auto_test')
    await deleteCategory('cat_auto_test')
  })

  test('publishes an untouched draft after its window', async () => {
    await createDraft('art_auto_untouched', 'auto-untouched')
    await createRun({
      source: 'cron',
      kind: 'initiative',
      activityId: null,
      articleId: 'art_auto_untouched',
      status: 'pending',
      autoPublishAt: new Date(Date.now() - 60_000).toISOString(),
    })

    const result = await processDueAutomation()
    expect(result.published).toBeGreaterThanOrEqual(1)

    const article = await getArticleById('art_auto_untouched')
    expect(article?.status).toBe('published')
  })

  test('does not publish a draft that was edited during the window', async () => {
    await createDraft('art_auto_edited', 'auto-edited')
    await createRun({
      source: 'cron',
      kind: 'activity',
      activityId: null,
      articleId: 'art_auto_edited',
      status: 'pending',
      autoPublishAt: new Date(Date.now() - 60_000).toISOString(),
    })

    await getDb()
      .update(articles)
      .set({ updatedAt: new Date(Date.now() + 1_000).toISOString() })
      .where(eq(articles.id, 'art_auto_edited'))

    const result = await processDueAutomation()
    expect(result.reviewed).toBeGreaterThanOrEqual(1)

    const article = await getArticleById('art_auto_edited')
    expect(article?.status).toBe('draft')
  })
})
