import { LOCALES, LOCALE_META, useI18n } from '../lib/i18n'

/**
 * One switcher for the whole application. It posts to `/locale`, which persists
 * the choice and redirects back to the same page in the new language, so the
 * control works without JavaScript and preserves the current URL.
 */
export function LanguageSwitcher({ variant = 'site' }: { variant?: 'site' | 'admin' }) {
  const { locale, t, currentPath } = useI18n()

  return (
    <form
      className={`lang-switch lang-switch--${variant}`}
      method="post"
      action="/locale"
      aria-label={t('nav.language')}
      data-lang-switch
    >
      <input type="hidden" name="next" value={currentPath} />
      {LOCALES.map((code) => {
        const meta = LOCALE_META[code]
        const active = code === locale
        return (
          <button
            key={code}
            type="submit"
            name="locale"
            value={code}
            className="lang-switch__option"
            aria-pressed={active}
            aria-label={
              active ? t('nav.current', { language: meta.label }) : t('nav.switchTo', { language: meta.label })
            }
            title={meta.label}
            lang={meta.htmlLang}
          >
            <span aria-hidden="true">{meta.shortLabel}</span>
          </button>
        )
      })}
    </form>
  )
}
