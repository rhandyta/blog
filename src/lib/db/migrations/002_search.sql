CREATE VIRTUAL TABLE IF NOT EXISTS article_fts USING fts5(
  article_id UNINDEXED,
  title,
  subtitle,
  excerpt,
  body,
  tags,
  tokenize = 'porter unicode61'
);
