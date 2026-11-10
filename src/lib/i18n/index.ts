export {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_META,
  isExternalHref,
  isLocale,
  localeFromAcceptLanguage,
  localizedPath,
  otherLocale,
  parseLocale,
  pluralCategory,
  resolveLocale,
  splitLocalePath,
  stripLocalePrefix,
  switchLocalePath,
  type Locale,
  type LocaleMeta,
} from './locale'

export {
  createTranslator,
  flattenMessages,
  getTranslator,
  hasMessage,
  interpolate,
  pluralBaseKey,
  rawMessage,
  translate,
  type Translate,
  type TranslationKey,
  type TranslationVars,
} from './translate'

export {
  DEFAULT_TIME_ZONE,
  formatCurrency,
  formatDate,
  formatList,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  type DateStyle,
} from './format'

export { createI18nValue, I18nProvider, useI18n, type I18nValue } from './react'
export { documentLocale } from './browser'
export { buildClientMessages, type ClientMessages } from './client'
export { articleStatusKey } from './status'
export { messages, type Messages } from './messages'
export { aboutDocument, privacyDocument, termsDocument, type AboutCopy, type LegalDocument } from './content/documents'
