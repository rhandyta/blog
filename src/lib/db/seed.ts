import { count } from 'drizzle-orm'
import { getConfig } from '../config'
import { docToText, makeExcerpt, readingMinutes } from '../content/doc'
import { parseMarkdown } from '../content/markdown'
import { coverAlt, coverSvg } from '../media/cover'
import { saveUpload } from '../media/storage'
import { getDb, run } from './client'
import { ensureDb } from './migrate'
import { articles, tags } from './schema'
import { seedArticles, seedAuthors, seedCategories, seedTags } from './seed-data'
import { createUser, getUserByEmail } from '../auth/session'
import { createArticle } from './queries/articles'
import { ACCENTS, defaultSettings, saveSiteSettings, upsertAuthor, upsertCategory } from './queries/taxonomy'

export async function seedDatabase(): Promise<void> {
  await ensureDb()
  const existing = await getDb().select({ n: count() }).from(articles)
  if ((existing[0]?.n ?? 0) > 0) {
    console.log('[seed] content already present — skipping. Run `bun run db:reset` to start over.')
    return
  }

  const config = getConfig()
  const now = new Date().toISOString()

  let user = await getUserByEmail(config.ADMIN_EMAIL)
  if (!user) {
    user = await createUser({
      id: 'user_editor',
      email: config.ADMIN_EMAIL,
      password: config.ADMIN_PASSWORD,
      name: 'Mira Vale',
      role: 'admin',
    })
    console.log(`[seed] created admin user ${user.email}`)
  }

  for (const author of seedAuthors) {
    await upsertAuthor({
      id: author.id,
      slug: author.slug,
      displayName: author.displayName,
      roleTitle: author.roleTitle,
      bio: author.bio,
      longBio: author.longBio,
      expertise: author.expertise,
      socialLinks: {},
      userId: author.id === 'author_mira' ? user.id : null,
      isDemo: true,
    })
  }

  for (const category of seedCategories) {
    await upsertCategory({
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      intro: category.intro,
      accent: category.accent as never,
      sortOrder: category.sortOrder,
    })
  }

  for (const tag of seedTags) {
    await getDb()
      .insert(tags)
      .values({ id: tag.id, slug: tag.slug, name: tag.name, description: tag.description, createdAt: now })
      .onConflictDoNothing()
  }

  const categoryById = new Map(seedCategories.map((category) => [category.id, category]))
  const tagBySlug = new Map(seedTags.map((tag) => [tag.slug, tag]))
  const accentHex = new Map<string, string>(ACCENTS.map((accent) => [accent.token, accent.hex]))

  console.log('[seed] generating cover art')
  const coverByArticle = new Map<string, string>()
  for (const [index, article] of seedArticles.entries()) {
    const category = categoryById.get(article.categoryId)
    const accent = accentHex.get(category?.accent ?? 'vermilion') ?? '#c8452b'
    const seed = index + 1
    const svg = coverSvg(seed, accent)
    const media = await saveUpload(Buffer.from(svg), {
      originalName: `cover-${article.slug}.svg`,
      alt: coverAlt(seed),
      caption: null,
      uploadedBy: user.id,
      allowSvg: true,
    })
    if (!media) throw new Error(`Failed to generate cover for ${article.slug}`)
    coverByArticle.set(article.id, media.id)
  }

  console.log('[seed] writing articles')
  for (const seedArticle of seedArticles) {
    const coverId = coverByArticle.get(seedArticle.id) ?? null
    const body = seedArticle.body.replace(/media:(cover\d+)/g, (_match, key: string) => {
      const index = Number(key.replace('cover', '')) - 1
      const target = seedArticles[index]
      const mediaId = target ? coverByArticle.get(target.id) : undefined
      return mediaId ? `media:${mediaId}` : _match
    })
    const doc = parseMarkdown(body)
    const bodyText = docToText(doc)
    const excerpt = makeExcerpt(bodyText, 200)
    const tagIds = seedArticle.tags
      .map((slug) => tagBySlug.get(slug)?.id)
      .filter((id): id is string => Boolean(id))

    await createArticle({
      id: seedArticle.id,
      slug: seedArticle.slug,
      title: seedArticle.title,
      subtitle: seedArticle.subtitle,
      excerpt,
      bodyJson: JSON.stringify(doc),
      bodyText,
      readingMinutes: readingMinutes(bodyText),
      status: seedArticle.status,
      authorId: seedArticle.authorId,
      categoryId: seedArticle.categoryId,
      featuredMediaId: coverId,
      featuredCaption: null,
      isFeatured: Boolean(seedArticle.featured),
      featuredRank: seedArticle.featuredRank ?? null,
      isEditorsPick: Boolean(seedArticle.pick),
      seoTitle: seedArticle.seoTitle ?? null,
      seoDescription: seedArticle.seoDescription ?? excerpt,
      canonicalUrl: null,
      ogMediaId: null,
      noIndex: false,
      isDemo: true,
      publishedAt: seedArticle.publishedAt,
      scheduledFor: seedArticle.scheduledFor ?? null,
      tagIds,
    })
    if (seedArticle.publishedAt) {
      await run('UPDATE articles SET updated_at = ? WHERE id = ?', [seedArticle.publishedAt, seedArticle.id])
    }
  }

  await saveSiteSettings({
    ...defaultSettings,
    about:
      'RhandytaVERSE is the personal publication of Rhandyta Briantama. I write about technology, design, science, culture, work, and ordinary life — the things I am reading, building, and thinking about.\n\nThe name comes from the commonplace books kept by readers for centuries: private collections of passages, observations, and ideas, copied out and returned to. The publication and the person are the same project: one reader, one desk, one ongoing record.\n\nEssays are published when there is something worth saying. The archive is kept in full, with no fixed schedule to keep up with.',
    email: 'hello@lab-rb.my.id',
    x: '',
    github: 'https://github.com/rhandyta',
    linkedin: '',
  })

  console.log(`[seed] done — ${seedArticles.length} articles, ${seedAuthors.length} authors, ${seedCategories.length} categories`)
}
