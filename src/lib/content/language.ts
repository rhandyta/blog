const INDONESIAN = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'dengan', 'ini', 'itu', 'tidak', 'dalam',
  'adalah', 'akan', 'pada', 'juga', 'saya', 'kita', 'mereka', 'atau', 'karena', 'bisa',
  'lebih', 'sudah', 'masih', 'sebagai', 'oleh', 'saat', 'ketika', 'tentang', 'sebuah',
  'para', 'harus', 'hanya', 'banyak', 'setiap', 'antar', 'secara', 'namun', 'tetapi',
])

const ENGLISH = new Set([
  'the', 'and', 'of', 'to', 'in', 'is', 'that', 'for', 'it', 'with', 'as', 'was',
  'on', 'are', 'this', 'be', 'by', 'from', 'or', 'an', 'not', 'we', 'you', 'they',
  'have', 'has', 'had', 'but', 'at', 'which', 'what', 'when', 'where', 'how', 'more',
])

export type ContentLanguage = 'id' | 'en'

/**
 * Coarse, intentionally simple language detection for editorial content.
 * It is only a fallback when an article has no explicit language.
 */
export function detectLanguage(text: string): ContentLanguage {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? []
  if (!words.length) return 'en'
  let indonesian = 0
  let english = 0
  for (const word of words.slice(0, 2000)) {
    if (INDONESIAN.has(word)) indonesian += 1
    if (ENGLISH.has(word)) english += 1
  }
  if (indonesian === 0 && english === 0) return 'en'
  return indonesian >= english ? 'id' : 'en'
}

export function articleLanguage(explicit: string | null | undefined, bodyText: string): ContentLanguage {
  const value = explicit?.trim().toLowerCase()
  if (value === 'id' || value === 'in') return 'id'
  if (value === 'en') return 'en'
  return detectLanguage(bodyText)
}

export function ogLocale(language: string): string {
  if (language === 'id' || language === 'in') return 'id_ID'
  return 'en_US'
}
