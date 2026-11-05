process.env.NODE_ENV = 'test'
process.env.DATABASE_PATH = ':memory:'
process.env.UPLOAD_DIR = './data/test-uploads'
process.env.PUBLIC_ORIGIN = 'http://localhost:3000'
process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef'
process.env.ADMIN_EMAIL = 'test@example.com'
process.env.ADMIN_PASSWORD = 'test-password-123'
process.env.DISABLE_SCHEDULER = '1'

const { ensureDb } = await import('../src/lib/db/migrate')
const { getDb } = await import('../src/lib/db/client')
const { articles, tags } = await import('../src/lib/db/schema')
const { count } = await import('drizzle-orm')
const { createUser, getUserByEmail } = await import('../src/lib/auth/session')
const { upsertAuthor, upsertCategory } = await import('../src/lib/db/queries/taxonomy')
const { createArticle } = await import('../src/lib/db/queries/articles')

await ensureDb()

const existing = await getDb().select({ n: count() }).from(articles)
if ((existing[0]?.n ?? 0) === 0) {
  let user = await getUserByEmail('test@example.com')
  if (!user) {
    user = await createUser({
      id: 'user_test',
      email: 'test@example.com',
      password: 'test-password-123',
      name: 'Test Editor',
      role: 'admin',
    })
  }

  await upsertCategory({
    id: 'cat_test',
    slug: 'test-section',
    name: 'Test Section',
    description: 'A section used by the automated tests.',
    intro: 'A demonstration section for tests.',
    accent: 'teal',
    sortOrder: 1,
  })
  await upsertAuthor({
    id: 'author_test',
    slug: 'test-author',
    displayName: 'Test Author',
    roleTitle: 'Tester',
    bio: 'A test author profile.',
    expertise: ['testing'],
    userId: user.id,
    isDemo: true,
  })
  await getDb()
    .insert(tags)
    .values({ id: 'tag_test', slug: 'test-tag', name: 'Test Tag', description: '', createdAt: new Date().toISOString() })
    .onConflictDoNothing()

  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'The notebook rewards attention and returning to the same pages. This sentence exists so the search index has something to find.',
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'A section heading' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'More about the practice of keeping notes across a long working life.' }],
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'A second section' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'A closing paragraph for the fixture article.' }],
      },
    ],
  }

  const base = {
    title: 'The Published Test Article',
    subtitle: 'A test subtitle',
    excerpt: 'A published article used by the automated tests.',
    bodyJson: JSON.stringify(doc),
    bodyText: 'The notebook rewards attention and returning to the same pages.',
    readingMinutes: 2,
    authorId: 'author_test',
    categoryId: 'cat_test',
    featuredMediaId: null,
    featuredCaption: null,
    isFeatured: true,
    featuredRank: 1,
    isEditorsPick: true,
    seoTitle: null,
    seoDescription: null,
    canonicalUrl: null,
    ogMediaId: null,
    noIndex: false,
    isDemo: true,
    tagIds: ['tag_test'],
  }

  await createArticle({
    ...base,
    id: 'art_test_published',
    slug: 'test-published',
    status: 'published',
    publishedAt: new Date(Date.now() - 86_400_000).toISOString(),
    scheduledFor: null,
  })
  await createArticle({
    ...base,
    id: 'art_test_draft',
    slug: 'test-draft',
    title: 'A Draft Test Article',
    status: 'draft',
    publishedAt: null,
    scheduledFor: null,
  })
  await createArticle({
    ...base,
    id: 'art_test_scheduled',
    slug: 'test-scheduled',
    title: 'A Scheduled Test Article',
    status: 'scheduled',
    publishedAt: null,
    scheduledFor: new Date(Date.now() + 86_400_000).toISOString(),
  })
  await createArticle({
    ...base,
    id: 'art_test_noindex',
    slug: 'test-noindex',
    title: 'A Noindex Test Article',
    status: 'published',
    publishedAt: new Date(Date.now() - 3_600_000).toISOString(),
    scheduledFor: null,
    noIndex: true,
  })

}

export const TEST_USER_ID = 'user_test'
export const TEST_PASSWORD = 'test-password-123'
export const TEST_EMAIL = 'test@example.com'
