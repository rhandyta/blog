import { LOCALE_META, type Locale } from './locale'
import type { Translate } from './translate'

/**
 * The small subset of copy the browser bundle needs. It is serialised into the
 * page as JSON, so client scripts never duplicate translated literals and the
 * page never needs a second render pass to hand strings over.
 */
export type ClientMessages = {
  locale: Locale
  dateLocale: string
  prefix: string
  theme: { light: string; dark: string }
  bookmarks: {
    save: string
    saved: string
    remove: string
    read: string
    count: string
    countOne: string
    emptyCount: string
    listLoading: string
    loadError: string
    empty: string
    emptyHint: string
  }
  newsletter: {
    invalid: string
    pending: string
    ok: string
    exists: string
    tooMany: string
    check: string
    connection: string
    subscribing: string
  }
  share: { copied: string; manual: string }
  copy: { copy: string; copied: string; manual: string }
  search: {
    searching: string
    count: string
    countOne: string
    none: string
    unavailable: string
    reading: string
    readingOne: string
  }
}

/** Builds the serialisable client bundle for one language. */
export function buildClientMessages(t: Translate, locale: Locale, prefix: string): ClientMessages {
  return {
    locale,
    dateLocale: LOCALE_META[locale].dateLocale,
    prefix,
    theme: { light: t('header.themeToLight'), dark: t('header.themeToDark') },
    bookmarks: {
      save: t('article.saveForLater'),
      saved: t('article.savedLabel'),
      remove: t('common.remove'),
      read: t('common.read'),
      count: t('saved.meta', { count: 2 }),
      countOne: t('saved.meta', { count: 1 }),
      emptyCount: t('saved.emptyMeta'),
      listLoading: t('saved.listLoading'),
      loadError: t('saved.loadError'),
      empty: t('saved.empty'),
      emptyHint: t('saved.emptyHint', { action: t('article.saveForLater') }),
    },
    newsletter: {
      invalid: t('subscribe.invalidEmail'),
      pending: t('subscribe.pendingNotice'),
      ok: t('subscribe.okNotice'),
      exists: t('subscribe.existsNotice'),
      tooMany: t('subscribe.tooMany'),
      check: t('subscribe.checkAgain'),
      connection: t('subscribe.connectionFailed'),
      subscribing: t('subscribe.subscribing'),
    },
    share: { copied: t('article.linkCopied'), manual: t('article.copyFromAddressBar') },
    copy: { copy: t('article.copy'), copied: t('article.copied'), manual: t('article.selectManually') },
    search: {
      searching: t('search.searchingFor', { query: '__QUERY__' }),
      count: t('search.liveCount', { count: 2, query: '__QUERY__' }),
      countOne: t('search.liveCount', { count: 1, query: '__QUERY__' }),
      none: t('search.noResults', { query: '__QUERY__' }),
      unavailable: t('search.unavailable'),
      reading: t('article.minRead', { count: 2 }),
      readingOne: t('article.minRead', { count: 1 }),
    },
  }
}
