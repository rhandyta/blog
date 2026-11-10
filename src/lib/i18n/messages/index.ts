import { admin } from './admin'
import { adminAudience } from './admin-audience'
import { adminAutomation } from './admin-automation'
import { adminContent } from './admin-content'
import { adminDashboard } from './admin-dashboard'
import { adminEditor } from './admin-editor'
import { adminSystem } from './admin-system'
import { common, errors, footer, header, nav } from './common'
import { content } from './content'
import { system } from './system'

/**
 * The single message registry. Every namespace is defined once per language and
 * the English tree is type-checked against the Indonesian one, so a missing key
 * is a compile error rather than a runtime surprise.
 */
export const messages = {
  id: {
    common: common.id,
    nav: nav.id,
    header: header.id,
    footer: footer.id,
    errors: errors.id,
    ...content.id,
    ...system.id,
    admin: admin.id,
    adminDashboard: adminDashboard.id,
    adminContent: adminContent.id,
    adminAudience: adminAudience.id,
    adminSystem: adminSystem.id,
    adminAutomation: adminAutomation.id,
    adminEditor: adminEditor.id,
  },
  en: {
    common: common.en,
    nav: nav.en,
    header: header.en,
    footer: footer.en,
    errors: errors.en,
    ...content.en,
    ...system.en,
    admin: admin.en,
    adminDashboard: adminDashboard.en,
    adminContent: adminContent.en,
    adminAudience: adminAudience.en,
    adminSystem: adminSystem.en,
    adminAutomation: adminAutomation.en,
    adminEditor: adminEditor.en,
  },
}

export type Messages = typeof messages.id

export {
  admin,
  adminAudience,
  adminAutomation,
  adminContent,
  adminDashboard,
  adminEditor,
  adminSystem,
  common,
  content,
  errors,
  footer,
  header,
  nav,
  system,
}
