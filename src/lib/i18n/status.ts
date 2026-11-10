import type { TranslationKey } from './translate'

/** Article lifecycle labels shared by the desk and the preview banner. */
export function articleStatusKey(status: string | null | undefined): TranslationKey {
  switch (status) {
    case 'published':
      return 'admin.statusPublished'
    case 'scheduled':
      return 'admin.statusScheduled'
    case 'archived':
      return 'admin.statusArchived'
    default:
      return 'admin.statusDraft'
  }
}
