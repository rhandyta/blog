import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'editor', 'author'] }).notNull().default('author'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  lastLoginAt: text('last_login_at'),
})

export const media = sqliteTable('media', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  byteSize: integer('byte_size').notNull().default(0),
  width: integer('width').notNull().default(0),
  height: integer('height').notNull().default(0),
  alt: text('alt').notNull().default(''),
  caption: text('caption'),
  dominantColor: text('dominant_color').notNull().default('#17140F'),
  src: text('src').notNull(),
  variants: text('variants').notNull().default('{}'),
  uploadedBy: text('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
})

export const authors = sqliteTable('authors', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  displayName: text('display_name').notNull(),
  roleTitle: text('role_title'),
  bio: text('bio').notNull().default(''),
  longBio: text('long_bio'),
  expertise: text('expertise').notNull().default('[]'),
  socialLinks: text('social_links').notNull().default('{}'),
  avatarMediaId: text('avatar_media_id').references(() => media.id, { onDelete: 'set null' }),
  isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  slugIdx: uniqueIndex('authors_slug_idx').on(table.slug),
}))

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  intro: text('intro').notNull().default(''),
  accent: text('accent').notNull().default('vermilion'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  slugIdx: uniqueIndex('categories_slug_idx').on(table.slug),
}))

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  slugIdx: uniqueIndex('tags_slug_idx').on(table.slug),
}))

export const articles = sqliteTable('articles', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  excerpt: text('excerpt').notNull().default(''),
  bodyJson: text('body_json').notNull(),
  bodyText: text('body_text').notNull().default(''),
  status: text('status', { enum: ['draft', 'scheduled', 'published', 'archived'] }).notNull().default('draft'),
  authorId: text('author_id').notNull().references(() => authors.id, { onDelete: 'restrict' }),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  featuredMediaId: text('featured_media_id').references(() => media.id, { onDelete: 'set null' }),
  featuredCaption: text('featured_caption'),
  readingMinutes: integer('reading_minutes').notNull().default(1),
  isFeatured: integer('is_featured', { mode: 'boolean' }).notNull().default(false),
  featuredRank: integer('featured_rank'),
  isEditorsPick: integer('is_editors_pick', { mode: 'boolean' }).notNull().default(false),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  canonicalUrl: text('canonical_url'),
  ogMediaId: text('og_media_id').references(() => media.id, { onDelete: 'set null' }),
  noIndex: integer('no_index', { mode: 'boolean' }).notNull().default(false),
  isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false),
  publishedAt: text('published_at'),
  scheduledFor: text('scheduled_for'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  slugIdx: uniqueIndex('articles_slug_idx').on(table.slug),
  statusIdx: index('articles_status_published_idx').on(table.status, table.publishedAt),
  categoryIdx: index('articles_category_idx').on(table.categoryId, table.status, table.publishedAt),
  authorIdx: index('articles_author_idx').on(table.authorId, table.status, table.publishedAt),
  featuredIdx: index('articles_featured_idx').on(table.isFeatured, table.featuredRank),
}))

export const articleTags = sqliteTable('article_tags', {
  articleId: text('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.articleId, table.tagId] }),
  tagIdx: index('article_tags_tag_idx').on(table.tagId),
}))

export const articleRevisions = sqliteTable('article_revisions', {
  id: text('id').primaryKey(),
  articleId: text('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  snapshotJson: text('snapshot_json').notNull(),
  note: text('note'),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  articleIdx: index('article_revisions_article_idx').on(table.articleId, table.createdAt),
}))

export const subscribers = sqliteTable('subscribers', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  status: text('status', { enum: ['subscribed', 'unsubscribed'] }).notNull().default('subscribed'),
  unsubscribeToken: text('unsubscribe_token').notNull(),
  source: text('source').notNull().default('site'),
  ipHash: text('ip_hash'),
  createdAt: text('created_at').notNull(),
  unsubscribedAt: text('unsubscribed_at'),
}, (table) => ({
  emailIdx: uniqueIndex('subscribers_email_idx').on(table.email),
}))

export const articleViews = sqliteTable('article_views', {
  articleId: text('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
  day: text('day').notNull(),
  count: integer('count').notNull().default(0),
}, (table) => ({
  pk: primaryKey({ columns: [table.articleId, table.day] }),
}))

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const automationActivity = sqliteTable('automation_activity', {
  id: text('id').primaryKey(),
  text: text('text').notNull().default(''),
  mediaId: text('media_id').references(() => media.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
  consumedAt: text('consumed_at'),
}, (table) => ({
  createdIdx: index('automation_activity_created_idx').on(table.createdAt),
}))

export const automationRuns = sqliteTable('automation_runs', {
  id: text('id').primaryKey(),
  source: text('source', { enum: ['manual', 'cron'] }).notNull(),
  kind: text('kind', { enum: ['activity', 'initiative'] }).notNull(),
  activityId: text('activity_id').references(() => automationActivity.id, { onDelete: 'set null' }),
  articleId: text('article_id').references(() => articles.id, { onDelete: 'set null' }),
  status: text('status', {
    enum: ['pending', 'published', 'reviewed', 'skipped', 'deleted', 'error'],
  }).notNull().default('pending'),
  error: text('error'),
  createdAt: text('created_at').notNull(),
  autoPublishAt: text('auto_publish_at'),
}, (table) => ({
  statusIdx: index('automation_runs_status_idx').on(table.status, table.autoPublishAt),
  createdIdx: index('automation_runs_created_idx').on(table.createdAt),
}))

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  csrfToken: text('csrf_token').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
  userAgent: text('user_agent'),
  ipHash: text('ip_hash'),
}, (table) => ({
  userIdx: index('sessions_user_idx').on(table.userId),
  expiresIdx: index('sessions_expires_idx').on(table.expiresAt),
}))

export type User = typeof users.$inferSelect
export type Author = typeof authors.$inferSelect
export type Article = typeof articles.$inferSelect
export type Category = typeof categories.$inferSelect
export type Tag = typeof tags.$inferSelect
export type MediaAsset = typeof media.$inferSelect
export type Subscriber = typeof subscribers.$inferSelect
export type ArticleRevision = typeof articleRevisions.$inferSelect
export type Session = typeof sessions.$inferSelect
export type AutomationActivity = typeof automationActivity.$inferSelect
export type AutomationRun = typeof automationRuns.$inferSelect
