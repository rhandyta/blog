export type TranslationVars = Record<string, string | number | boolean | null | undefined>

const INTERPOLATION = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g

/** Replaces `{{name}}` placeholders. Unknown placeholders are left untouched. */
export function interpolate(template: string, vars: TranslationVars = {}): string {
  return template.replace(INTERPOLATION, (match, name: string) => {
    if (!Object.hasOwn(vars, name)) return match
    const value = vars[name]
    return value === null || value === undefined ? '' : String(value)
  })
}
