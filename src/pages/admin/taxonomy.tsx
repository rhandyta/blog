import type { AuthorWithCount, CategoryWithCount, TagWithCount } from '../../lib/db/queries/taxonomy'
import { ACCENTS } from '../../lib/db/queries/taxonomy'
import type { Author, Category, Tag, User } from '../../lib/db/schema'
import { useI18n, type TranslationKey } from '../../lib/i18n'
import { AdminLayout } from '../../components/layout'
import { CsrfField, ErrorList, type Flash } from './shared'

const accentOptions = ACCENTS

const accentLabelKeys: Record<string, TranslationKey> = {
  vermilion: 'adminContent.accents.vermilion',
  indigo: 'adminContent.accents.indigo',
  ultramarine: 'adminContent.accents.ultramarine',
  ochre: 'adminContent.accents.ochre',
  teal: 'adminContent.accents.teal',
  plum: 'adminContent.accents.plum',
  moss: 'adminContent.accents.moss',
  clay: 'adminContent.accents.clay',
}

export function CategoriesPage({
  user,
  categories,
  session,
  flash,
  errors,
}: {
  user: User
  categories: CategoryWithCount[]
  session: { csrfToken: string }
  flash: Flash
  errors?: string[]
}) {
  const { t } = useI18n()
  return (
    <AdminLayout
      user={user}
      path="/admin/categories"
      title={t('adminContent.categories.title')}
      subtitle={t('adminContent.categories.subtitle', { count: categories.length })}
      flash={flash}
      csrfToken={session.csrfToken}
    >
      <ErrorList errors={errors ?? []} />
      <div className="admin-grid">
        <section className="admin-card" style={{ gridColumn: 'span 7' }}>
          <div className="admin-table-wrap" style={{ border: 0 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('adminContent.common.name')}</th>
                  <th>{t('adminContent.common.slug')}</th>
                  <th>{t('adminContent.common.accent')}</th>
                  <th className="num">{t('adminContent.common.pieces')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td className="title-cell">{category.name}</td>
                    <td className="muted-cell">/{category.slug}</td>
                    <td className="muted-cell">{category.accent}</td>
                    <td className="num">{category.articleCount}</td>
                    <td>
                      <a className="btn btn--ghost btn--small" href={`/admin/categories/${category.id}`}>
                        {t('adminContent.common.edit')}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card" style={{ gridColumn: 'span 5' }}>
          <h2>{t('adminContent.categories.newTitle')}</h2>
          <form method="post" action="/admin/categories" className="admin-form">
            <CsrfField token={session.csrfToken} />
            <div className="field">
              <label htmlFor="name">{t('adminContent.common.name')}</label>
              <input className="input" id="name" name="name" required maxLength={60} />
            </div>
            <div className="field">
              <label htmlFor="slug">{t('adminContent.common.slugOptional')}</label>
              <input className="input" id="slug" name="slug" placeholder={t('adminContent.common.generatedSlug')} />
            </div>
            <div className="field">
              <label htmlFor="description">{t('adminContent.common.description')}</label>
              <textarea className="textarea" id="description" name="description" rows={2} maxLength={200} />
            </div>
            <div className="field">
              <label htmlFor="intro">{t('adminContent.common.intro')}</label>
              <textarea className="textarea" id="intro" name="intro" rows={3} maxLength={400} />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="accent">{t('adminContent.common.accent')}</label>
                <select className="select" id="accent" name="accent" defaultValue="vermilion">
                  {accentOptions.map((accent) => (
                    <option key={accent.token} value={accent.token}>
                      {t(accentLabelKeys[accent.token])}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="sortOrder">{t('adminContent.common.sortOrder')}</label>
                <input
                  className="input"
                  id="sortOrder"
                  name="sortOrder"
                  type="number"
                  defaultValue={0}
                  min={0}
                  max={99}
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">
                {t('adminContent.categories.create')}
              </button>
            </div>
          </form>
        </section>
      </div>
    </AdminLayout>
  )
}

export function CategoryEditPage({
  user,
  category,
  session,
  flash,
  errors,
}: {
  user: User
  category: Category
  session: { csrfToken: string }
  flash: Flash
  errors?: string[]
}) {
  const { t } = useI18n()
  return (
    <AdminLayout
      user={user}
      path="/admin/categories"
      title={category.name}
      subtitle={t('adminContent.categories.editTitle', { slug: category.slug })}
      actions={
        <a className="btn btn--ghost" href={`/category/${category.slug}`} target="_blank" rel="noopener">
          {t('adminContent.categories.view')}
        </a>
      }
      flash={flash}
      csrfToken={session.csrfToken}
    >
      <ErrorList errors={errors ?? []} />
      <div className="admin-grid">
        <section className="admin-card" style={{ gridColumn: 'span 7' }}>
          <form method="post" action={`/admin/categories/${category.id}`} className="admin-form">
            <CsrfField token={session.csrfToken} />
            <div className="field">
              <label htmlFor="name">{t('adminContent.common.name')}</label>
              <input className="input" id="name" name="name" defaultValue={category.name} required maxLength={60} />
            </div>
            <div className="field">
              <label htmlFor="slug">{t('adminContent.common.slug')}</label>
              <input className="input" id="slug" name="slug" defaultValue={category.slug} required />
              <p className="hint">{t('adminContent.common.slugHint')}</p>
            </div>
            <div className="field">
              <label htmlFor="description">{t('adminContent.common.description')}</label>
              <textarea
                className="textarea"
                id="description"
                name="description"
                rows={2}
                defaultValue={category.description}
                maxLength={200}
              />
            </div>
            <div className="field">
              <label htmlFor="intro">{t('adminContent.common.intro')}</label>
              <textarea
                className="textarea"
                id="intro"
                name="intro"
                rows={4}
                defaultValue={category.intro}
                maxLength={400}
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="accent">{t('adminContent.common.accent')}</label>
                <select className="select" id="accent" name="accent" defaultValue={category.accent}>
                  {accentOptions.map((accent) => (
                    <option key={accent.token} value={accent.token}>
                      {t(accentLabelKeys[accent.token])}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="sortOrder">{t('adminContent.common.sortOrder')}</label>
                <input
                  className="input"
                  id="sortOrder"
                  name="sortOrder"
                  type="number"
                  defaultValue={category.sortOrder}
                  min={0}
                  max={99}
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">
                {t('adminContent.categories.save')}
              </button>
            </div>
          </form>
        </section>

        <aside className="admin-card" style={{ gridColumn: 'span 5' }}>
          <h2>{t('adminContent.common.dangerZone')}</h2>
          <p className="hint" style={{ marginBottom: '1rem' }}>
            {t('adminContent.categories.deleteNote')}
          </p>
          <form
            method="post"
            action={`/admin/categories/${category.id}/delete`}
            data-confirm={t('adminContent.categories.deleteConfirm')}
          >
            <CsrfField token={session.csrfToken} />
            <button className="btn btn--danger" type="submit">
              {t('adminContent.categories.delete')}
            </button>
          </form>
        </aside>
      </div>
    </AdminLayout>
  )
}

export function TagsPage({
  user,
  tags,
  session,
  flash,
  errors,
}: {
  user: User
  tags: TagWithCount[]
  session: { csrfToken: string }
  flash: Flash
  errors?: string[]
}) {
  const { t } = useI18n()
  return (
    <AdminLayout
      user={user}
      path="/admin/tags"
      title={t('adminContent.tags.title')}
      subtitle={t('adminContent.tags.subtitle', { count: tags.length })}
      flash={flash}
      csrfToken={session.csrfToken}
    >
      <ErrorList errors={errors ?? []} />
      <div className="admin-grid">
        <section className="admin-card" style={{ gridColumn: 'span 7' }}>
          <div className="admin-table-wrap" style={{ border: 0 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('adminContent.common.name')}</th>
                  <th>{t('adminContent.common.slug')}</th>
                  <th className="num">{t('adminContent.tags.uses')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tags.map((tag) => (
                  <tr key={tag.id}>
                    <td className="title-cell">{tag.name}</td>
                    <td className="muted-cell">/{tag.slug}</td>
                    <td className="num">{tag.articleCount}</td>
                    <td>
                      <a className="btn btn--ghost btn--small" href={`/admin/tags/${tag.id}`}>
                        {t('adminContent.common.edit')}
                      </a>
                    </td>
                  </tr>
                ))}
                {!tags.length ? (
                  <tr>
                    <td colSpan={4} className="hint" style={{ padding: '1.5rem' }}>
                      {t('adminContent.tags.empty')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card" style={{ gridColumn: 'span 5' }}>
          <h2>{t('adminContent.tags.newTitle')}</h2>
          <form method="post" action="/admin/tags" className="admin-form">
            <CsrfField token={session.csrfToken} />
            <div className="field">
              <label htmlFor="name">{t('adminContent.common.name')}</label>
              <input className="input" id="name" name="name" required maxLength={40} />
            </div>
            <div className="field">
              <label htmlFor="slug">{t('adminContent.common.slugOptional')}</label>
              <input className="input" id="slug" name="slug" placeholder={t('adminContent.common.generatedSlug')} />
            </div>
            <div className="field">
              <label htmlFor="description">{t('adminContent.common.description')}</label>
              <textarea className="textarea" id="description" name="description" rows={2} maxLength={200} />
            </div>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">
                {t('adminContent.tags.create')}
              </button>
            </div>
          </form>
        </section>
      </div>
    </AdminLayout>
  )
}

export function TagEditPage({
  user,
  tag,
  session,
  flash,
  errors,
}: {
  user: User
  tag: Tag
  session: { csrfToken: string }
  flash: Flash
  errors?: string[]
}) {
  const { t } = useI18n()
  return (
    <AdminLayout
      user={user}
      path="/admin/tags"
      title={tag.name}
      subtitle={t('adminContent.tags.editTitle', { slug: tag.slug })}
      actions={
        <a className="btn btn--ghost" href={`/tags/${tag.slug}`} target="_blank" rel="noopener">
          {t('adminContent.tags.view')}
        </a>
      }
      flash={flash}
      csrfToken={session.csrfToken}
    >
      <ErrorList errors={errors ?? []} />
      <div className="admin-grid">
        <section className="admin-card" style={{ gridColumn: 'span 7' }}>
          <form method="post" action={`/admin/tags/${tag.id}`} className="admin-form">
            <CsrfField token={session.csrfToken} />
            <div className="field">
              <label htmlFor="name">{t('adminContent.common.name')}</label>
              <input className="input" id="name" name="name" defaultValue={tag.name} required maxLength={40} />
            </div>
            <div className="field">
              <label htmlFor="slug">{t('adminContent.common.slug')}</label>
              <input className="input" id="slug" name="slug" defaultValue={tag.slug} required />
            </div>
            <div className="field">
              <label htmlFor="description">{t('adminContent.common.description')}</label>
              <textarea
                className="textarea"
                id="description"
                name="description"
                rows={3}
                defaultValue={tag.description}
                maxLength={200}
              />
            </div>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">
                {t('adminContent.tags.save')}
              </button>
            </div>
          </form>
        </section>
        <aside className="admin-card" style={{ gridColumn: 'span 5' }}>
          <h2>{t('adminContent.common.dangerZone')}</h2>
          <p className="hint" style={{ marginBottom: '1rem' }}>
            {t('adminContent.tags.deleteNote')}
          </p>
          <form
            method="post"
            action={`/admin/tags/${tag.id}/delete`}
            data-confirm={t('adminContent.tags.deleteConfirm')}
          >
            <CsrfField token={session.csrfToken} />
            <button className="btn btn--danger" type="submit">
              {t('adminContent.tags.delete')}
            </button>
          </form>
        </aside>
      </div>
    </AdminLayout>
  )
}

export function AuthorsPage({
  user,
  authors,
  session,
  flash,
  errors,
}: {
  user: User
  authors: AuthorWithCount[]
  session: { csrfToken: string }
  flash: Flash
  errors?: string[]
}) {
  const { t } = useI18n()
  return (
    <AdminLayout
      user={user}
      path="/admin/authors"
      title={t('adminContent.authors.title')}
      subtitle={t('adminContent.authors.subtitle', { count: authors.length })}
      flash={flash}
      csrfToken={session.csrfToken}
    >
      <ErrorList errors={errors ?? []} />
      <div className="admin-grid">
        <section className="admin-card" style={{ gridColumn: 'span 7' }}>
          <div className="admin-table-wrap" style={{ border: 0 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('adminContent.common.name')}</th>
                  <th>{t('adminContent.common.role')}</th>
                  <th className="num">{t('adminContent.common.pieces')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {authors.map((author) => (
                  <tr key={author.id}>
                    <td className="title-cell">
                      {author.displayName}
                      <div className="meta" style={{ marginTop: '0.2rem' }}>
                        /{author.slug}
                      </div>
                    </td>
                    <td className="muted-cell">{author.roleTitle ?? '—'}</td>
                    <td className="num">{author.articleCount}</td>
                    <td>
                      <a className="btn btn--ghost btn--small" href={`/admin/authors/${author.id}`}>
                        {t('adminContent.common.edit')}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card" style={{ gridColumn: 'span 5' }}>
          <h2>{t('adminContent.authors.newTitle')}</h2>
          <form method="post" action="/admin/authors" className="admin-form">
            <CsrfField token={session.csrfToken} />
            <div className="field">
              <label htmlFor="displayName">{t('adminContent.common.displayName')}</label>
              <input className="input" id="displayName" name="displayName" required maxLength={80} />
            </div>
            <div className="field">
              <label htmlFor="roleTitle">{t('adminContent.common.role')}</label>
              <input
                className="input"
                id="roleTitle"
                name="roleTitle"
                placeholder={t('adminContent.authors.rolePlaceholder')}
                maxLength={60}
              />
            </div>
            <div className="field">
              <label htmlFor="bio">{t('adminContent.common.shortBio')}</label>
              <textarea className="textarea" id="bio" name="bio" rows={2} maxLength={300} />
            </div>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">
                {t('adminContent.authors.create')}
              </button>
            </div>
          </form>
        </section>
      </div>
    </AdminLayout>
  )
}

export function AuthorEditPage({
  user,
  author,
  session,
  flash,
  errors,
}: {
  user: User
  author: Author
  session: { csrfToken: string }
  flash: Flash
  errors?: string[]
}) {
  const { t } = useI18n()
  let expertise: string[] = []
  try {
    const parsed = JSON.parse(author.expertise)
    if (Array.isArray(parsed)) expertise = parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    expertise = []
  }
  let socials: Record<string, string> = {}
  try {
    const parsed = JSON.parse(author.socialLinks)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      socials = Object.fromEntries(
        Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
      )
    }
  } catch {
    socials = {}
  }

  return (
    <AdminLayout
      user={user}
      path="/admin/authors"
      title={author.displayName}
      subtitle={t('adminContent.authors.editTitle', { slug: author.slug })}
      actions={
        <a className="btn btn--ghost" href={`/author/${author.slug}`} target="_blank" rel="noopener">
          {t('adminContent.authors.view')}
        </a>
      }
      flash={flash}
      csrfToken={session.csrfToken}
    >
      <ErrorList errors={errors ?? []} />
      <div className="admin-grid">
        <section className="admin-card" style={{ gridColumn: 'span 8' }}>
          <form method="post" action={`/admin/authors/${author.id}`} className="admin-form">
            <CsrfField token={session.csrfToken} />
            <div className="form-row">
              <div className="field">
                <label htmlFor="displayName">{t('adminContent.common.displayName')}</label>
                <input
                  className="input"
                  id="displayName"
                  name="displayName"
                  defaultValue={author.displayName}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="roleTitle">{t('adminContent.common.role')}</label>
                <input className="input" id="roleTitle" name="roleTitle" defaultValue={author.roleTitle ?? ''} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="slug">{t('adminContent.common.slug')}</label>
              <input className="input" id="slug" name="slug" defaultValue={author.slug} required />
            </div>
            <div className="field">
              <label htmlFor="bio">{t('adminContent.common.shortBio')}</label>
              <textarea className="textarea" id="bio" name="bio" rows={2} defaultValue={author.bio} maxLength={300} />
            </div>
            <div className="field">
              <label htmlFor="longBio">{t('adminContent.common.longBio')}</label>
              <textarea
                className="textarea"
                id="longBio"
                name="longBio"
                rows={5}
                defaultValue={author.longBio ?? ''}
                maxLength={2000}
              />
            </div>
            <div className="field">
              <label htmlFor="expertise">{t('adminContent.common.expertise')}</label>
              <input className="input" id="expertise" name="expertise" defaultValue={expertise.join(', ')} />
            </div>
            <div className="field">
              <label htmlFor="website">{t('adminContent.common.website')}</label>
              <input
                className="input"
                id="website"
                name="website"
                type="url"
                defaultValue={socials.website ?? ''}
                placeholder="https://"
              />
            </div>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">
                {t('adminContent.authors.save')}
              </button>
            </div>
          </form>
        </section>
        <aside className="admin-card" style={{ gridColumn: 'span 4' }}>
          <h2>{t('adminContent.authors.notes')}</h2>
          <p className="hint">{t('adminContent.authors.notesText')}</p>
          <h2 style={{ marginTop: '1.5rem' }}>{t('adminContent.common.dangerZone')}</h2>
          <form
            method="post"
            action={`/admin/authors/${author.id}/delete`}
            data-confirm={t('adminContent.authors.deleteConfirm')}
          >
            <CsrfField token={session.csrfToken} />
            <button className="btn btn--danger" type="submit">
              {t('adminContent.authors.delete')}
            </button>
          </form>
        </aside>
      </div>
    </AdminLayout>
  )
}
