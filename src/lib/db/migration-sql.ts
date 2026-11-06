export type Migration = { name: string; sql: string }

export const migrations: Migration[] = [
  {
    name: '001_init.sql',
    sql: `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'author' CHECK (role IN ('admin', 'editor', 'author')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  alt TEXT NOT NULL DEFAULT '',
  caption TEXT,
  dominant_color TEXT NOT NULL DEFAULT '#17140F',
  src TEXT NOT NULL,
  variants TEXT NOT NULL DEFAULT '{}',
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS authors (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  role_title TEXT,
  bio TEXT NOT NULL DEFAULT '',
  long_bio TEXT,
  expertise TEXT NOT NULL DEFAULT '[]',
  social_links TEXT NOT NULL DEFAULT '{}',
  avatar_media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  intro TEXT NOT NULL DEFAULT '',
  accent TEXT NOT NULL DEFAULT 'vermilion',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  excerpt TEXT NOT NULL DEFAULT '',
  body_json TEXT NOT NULL,
  body_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  author_id TEXT NOT NULL REFERENCES authors(id) ON DELETE RESTRICT,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  featured_media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  featured_caption TEXT,
  reading_minutes INTEGER NOT NULL DEFAULT 1,
  is_featured INTEGER NOT NULL DEFAULT 0,
  featured_rank INTEGER,
  is_editors_pick INTEGER NOT NULL DEFAULT 0,
  seo_title TEXT,
  seo_description TEXT,
  canonical_url TEXT,
  og_media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  no_index INTEGER NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  scheduled_for TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS articles_status_published_idx ON articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS articles_category_idx ON articles(category_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS articles_author_idx ON articles(author_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS articles_featured_idx ON articles(is_featured, featured_rank);

CREATE TABLE IF NOT EXISTS article_tags (
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);
CREATE INDEX IF NOT EXISTS article_tags_tag_idx ON article_tags(tag_id);

CREATE TABLE IF NOT EXISTS article_revisions (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  note TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS article_revisions_article_idx ON article_revisions(article_id, created_at DESC);

CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'unsubscribed')),
  unsubscribe_token TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'site',
  ip_hash TEXT,
  created_at TEXT NOT NULL,
  unsubscribed_at TEXT
);

CREATE TABLE IF NOT EXISTS article_views (
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, day)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  user_agent TEXT,
  ip_hash TEXT
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);
`,
  },
  {
    name: '002_search.sql',
    sql: `
CREATE VIRTUAL TABLE IF NOT EXISTS article_fts USING fts5(
  article_id UNINDEXED,
  title,
  subtitle,
  excerpt,
  body,
  tags,
  tokenize = 'porter unicode61'
);
`,
  },
  {
    name: '003_automation.sql',
    sql: `
CREATE TABLE IF NOT EXISTS automation_activity (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL DEFAULT '',
  media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  consumed_at TEXT
);
CREATE INDEX IF NOT EXISTS automation_activity_created_idx ON automation_activity(created_at DESC);

CREATE TABLE IF NOT EXISTS automation_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('manual', 'cron')),
  kind TEXT NOT NULL CHECK (kind IN ('activity', 'initiative')),
  activity_id TEXT REFERENCES automation_activity(id) ON DELETE SET NULL,
  article_id TEXT REFERENCES articles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'reviewed', 'skipped', 'deleted', 'error')),
  error TEXT,
  created_at TEXT NOT NULL,
  auto_publish_at TEXT
);
CREATE INDEX IF NOT EXISTS automation_runs_status_idx ON automation_runs(status, auto_publish_at);
CREATE INDEX IF NOT EXISTS automation_runs_created_idx ON automation_runs(created_at DESC);
`,
  },
  {
    name: '004_automation_covers.sql',
    sql: `
ALTER TABLE automation_runs ADD COLUMN cover_source TEXT;
ALTER TABLE automation_runs ADD COLUMN cover_error TEXT;
`,
  },
  {
    name: '005_analytics.sql',
    sql: `
CREATE TABLE IF NOT EXISTS article_visits (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  visitor_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  bucket TEXT NOT NULL,
  created_at TEXT NOT NULL,
  referrer_host TEXT,
  country TEXT,
  device TEXT NOT NULL DEFAULT 'unknown',
  browser TEXT NOT NULL DEFAULT 'unknown',
  os TEXT NOT NULL DEFAULT 'unknown'
);
CREATE UNIQUE INDEX IF NOT EXISTS article_visits_unique_idx ON article_visits(article_id, visitor_hash, bucket);
CREATE INDEX IF NOT EXISTS article_visits_article_idx ON article_visits(article_id, day DESC);
CREATE INDEX IF NOT EXISTS article_visits_day_idx ON article_visits(day);
CREATE INDEX IF NOT EXISTS article_visits_visitor_idx ON article_visits(visitor_hash);
CREATE INDEX IF NOT EXISTS article_visits_referrer_idx ON article_visits(referrer_host);

CREATE TABLE IF NOT EXISTS article_readers (
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  visitor_hash TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  visits INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (article_id, visitor_hash)
);
CREATE INDEX IF NOT EXISTS article_readers_visitor_idx ON article_readers(visitor_hash);
`,
  },
  {
    name: '006_newsletter.sql',
    sql: `
ALTER TABLE subscribers ADD COLUMN confirmed_at TEXT;
ALTER TABLE subscribers ADD COLUMN confirmation_token TEXT;
ALTER TABLE subscribers ADD COLUMN confirmation_sent_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS subscribers_confirmation_token_idx ON subscribers(confirmation_token);
UPDATE subscribers SET confirmed_at = created_at WHERE status = 'subscribed' AND confirmed_at IS NULL;

CREATE TABLE IF NOT EXISTS newsletter_broadcasts (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS newsletter_broadcasts_created_idx ON newsletter_broadcasts(created_at DESC);
`,
  },
  {
    name: '007_newsletter_digest.sql',
    sql: `
ALTER TABLE newsletter_broadcasts ADD COLUMN kind TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE newsletter_broadcasts ADD COLUMN period_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_broadcasts_digest_period_idx ON newsletter_broadcasts(kind, period_key);

CREATE TABLE IF NOT EXISTS newsletter_schedule (
  id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  cadence TEXT NOT NULL DEFAULT 'weekly' CHECK (cadence IN ('daily', 'weekly', 'monthly')),
  weekday INTEGER NOT NULL DEFAULT 1,
  hour_utc INTEGER NOT NULL DEFAULT 2,
  metric TEXT NOT NULL DEFAULT 'readers' CHECK (metric IN ('readers', 'views')),
  article_limit INTEGER NOT NULL DEFAULT 5,
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO newsletter_schedule (id, enabled, cadence, weekday, hour_utc, metric, article_limit, updated_at)
VALUES ('digest', 1, 'weekly', 1, 2, 'readers', 5, CURRENT_TIMESTAMP);
`,
  },
]
