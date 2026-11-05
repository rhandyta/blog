import type { AuthorWithCount, CategoryWithCount, SiteSettings, TagWithCount } from '../../lib/db/queries/taxonomy'
import { ACCENTS } from '../../lib/db/queries/taxonomy'
import type { Author, Category, Tag, User } from '../../lib/db/schema'
import { AdminLayout } from '../../components/layout'
import { CsrfField, ErrorList, Flash } from './shared'

const accentOptions = ACCENTS

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
  return (
    <AdminLayout user={user} path="/admin/categories" title="Categories" subtitle={`${categories.length} sections`} flash={flash} csrfToken={session.csrfToken}>
      <ErrorList errors={errors ?? []} />
      <div className="admin-grid">
        <section className="admin-card" style={{ gridColumn: 'span 7' }}>
          <div className="admin-table-wrap" style={{ border: 0 }}>
            <table className="admin-table">
              <thead>
                <tr><th>Name</th><th>Slug</th><th>Accent</th><th className="num">Pieces</th><th /></tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td className="title-cell">{category.name}</td>
                    <td className="muted-cell">/{category.slug}</td>
                    <td className="muted-cell">{category.accent}</td>
                    <td className="num">{category.articleCount}</td>
                    <td><a className="btn btn--ghost btn--small" href={`/admin/categories/${category.id}`}>Edit</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card" style={{ gridColumn: 'span 5' }}>
          <h2>New section</h2>
          <form method="post" action="/admin/categories" className="admin-form">
            <CsrfField token={session.csrfToken} />
            <div className="field">
              <label htmlFor="name">Name</label>
              <input className="input" id="name" name="name" required maxLength={60} />
            </div>
            <div className="field">
              <label htmlFor="slug">Slug (optional)</label>
              <input className="input" id="slug" name="slug" placeholder="generated from the name" />
            </div>
            <div className="field">
              <label htmlFor="description">Description</label>
              <textarea className="textarea" id="description" name="description" rows={2} maxLength={200} />
            </div>
            <div className="field">
              <label htmlFor="intro">Introduction</label>
              <textarea className="textarea" id="intro" name="intro" rows={3} maxLength={400} />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="accent">Accent</label>
                <select className="select" id="accent" name="accent" defaultValue="vermilion">
                  {accentOptions.map((accent) => (
                    <option key={accent.token} value={accent.token}>{accent.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="sortOrder">Sort order</label>
                <input className="input" id="sortOrder" name="sortOrder" type="number" defaultValue={0} min={0} max={99} />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">Create section</button>
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
  return (
    <AdminLayout
      user={user}
      path="/admin/categories"
      title={category.name}
      subtitle={`Section · /category/${category.slug}`}
      actions={<a className="btn btn--ghost" href={`/category/${category.slug}`} target="_blank" rel="noopener">View section ↗</a>}
      flash={flash}
      csrfToken={session.csrfToken}
    >
      <ErrorList errors={errors ?? []} />
      <div className="admin-grid">
        <section className="admin-card" style={{ gridColumn: 'span 7' }}>
          <form method="post" action={`/admin/categories/${category.id}`} className="admin-form">
            <CsrfField token={session.csrfToken} />
            <div className="field">
              <label htmlFor="name">Name</label>
              <input className="input" id="name" name="name" defaultValue={category.name} required maxLength={60} />
            </div>
            <div className="field">
              <label htmlFor="slug">Slug</label>
              <input className="input" id="slug" name="slug" defaultValue={category.slug} required />
              <p className="hint">Changing the slug changes the public URL.</p>
            </div>
            <div className="field">
              <label htmlFor="description">Description</label>
              <textarea className="textarea" id="description" name="description" rows={2} defaultValue={category.description} maxLength={200} />
            </div>
            <div className="field">
              <label htmlFor="intro">Introduction</label>
              <textarea className="textarea" id="intro" name="intro" rows={4} defaultValue={category.intro} maxLength={400} />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="accent">Accent</label>
                <select className="select" id="accent" name="accent" defaultValue={category.accent}>
                  {accentOptions.map((accent) => (
                    <option key={accent.token} value={accent.token}>{accent.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="sortOrder">Sort order</label>
                <input className="input" id="sortOrder" name="sortOrder" type="number" defaultValue={category.sortOrder} min={0} max={99} />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">Save section</button>
            </div>
          </form>
        </section>

        <aside className="admin-card" style={{ gridColumn: 'span 5' }}>
          <h2>Danger zone</h2>
          <p className="hint" style={{ marginBottom: '1rem' }}>
            Deleting a section does not delete its articles. They become uncategorised, so decide where they belong
            before removing a section.
          </p>
          <form method="post" action={`/admin/categories/${category.id}/delete`} data-confirm="Delete this section? Articles will become uncategorised.">
            <CsrfField token={session.csrfToken} />
            <button className="btn btn--danger" type="submit">Delete section</button>
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
  return (
    <AdminLayout user={user} path="/admin/tags" title="Tags" subtitle={`${tags.length} tags`} flash={flash} csrfToken={session.csrfToken}>
      <ErrorList errors={errors ?? []} />
      <div className="admin-grid">
        <section className="admin-card" style={{ gridColumn: 'span 7' }}>
          <div className="admin-table-wrap" style={{ border: 0 }}>
            <table className="admin-table">
              <thead><tr><th>Name</th><th>Slug</th><th className="num">Uses</th><th /></tr></thead>
              <tbody>
                {tags.map((tag) => (
                  <tr key={tag.id}>
                    <td className="title-cell">{tag.name}</td>
                    <td className="muted-cell">/{tag.slug}</td>
                    <td className="num">{tag.articleCount}</td>
                    <td><a className="btn btn--ghost btn--small" href={`/admin/tags/${tag.id}`}>Edit</a></td>
                  </tr>
                ))}
                {!tags.length ? <tr><td colSpan={4} className="hint" style={{ padding: '1.5rem' }}>No tags yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card" style={{ gridColumn: 'span 5' }}>
          <h2>New tag</h2>
          <form method="post" action="/admin/tags" className="admin-form">
            <CsrfField token={session.csrfToken} />
            <div className="field">
              <label htmlFor="name">Name</label>
              <input className="input" id="name" name="name" required maxLength={40} />
            </div>
            <div className="field">
              <label htmlFor="slug">Slug (optional)</label>
              <input className="input" id="slug" name="slug" placeholder="generated from the name" />
            </div>
            <div className="field">
              <label htmlFor="description">Description</label>
              <textarea className="textarea" id="description" name="description" rows={2} maxLength={200} />
            </div>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">Create tag</button>
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
  return (
    <AdminLayout
      user={user}
      path="/admin/tags"
      title={tag.name}
      subtitle={`Tag · /tags/${tag.slug}`}
      actions={<a className="btn btn--ghost" href={`/tags/${tag.slug}`} target="_blank" rel="noopener">View tag ↗</a>}
      flash={flash}
      csrfToken={session.csrfToken}
    >
      <ErrorList errors={errors ?? []} />
      <div className="admin-grid">
        <section className="admin-card" style={{ gridColumn: 'span 7' }}>
          <form method="post" action={`/admin/tags/${tag.id}`} className="admin-form">
            <CsrfField token={session.csrfToken} />
            <div className="field">
              <label htmlFor="name">Name</label>
              <input className="input" id="name" name="name" defaultValue={tag.name} required maxLength={40} />
            </div>
            <div className="field">
              <label htmlFor="slug">Slug</label>
              <input className="input" id="slug" name="slug" defaultValue={tag.slug} required />
            </div>
            <div className="field">
              <label htmlFor="description">Description</label>
              <textarea className="textarea" id="description" name="description" rows={3} defaultValue={tag.description} maxLength={200} />
            </div>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">Save tag</button>
            </div>
          </form>
        </section>
        <aside className="admin-card" style={{ gridColumn: 'span 5' }}>
          <h2>Danger zone</h2>
          <p className="hint" style={{ marginBottom: '1rem' }}>Deleting a tag removes it from every article. The articles remain published.</p>
          <form method="post" action={`/admin/tags/${tag.id}/delete`} data-confirm="Delete this tag from every article?">
            <CsrfField token={session.csrfToken} />
            <button className="btn btn--danger" type="submit">Delete tag</button>
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
  return (
    <AdminLayout user={user} path="/admin/authors" title="Authors" subtitle={`${authors.length} profiles`} flash={flash} csrfToken={session.csrfToken}>
      <ErrorList errors={errors ?? []} />
      <div className="admin-grid">
        <section className="admin-card" style={{ gridColumn: 'span 7' }}>
          <div className="admin-table-wrap" style={{ border: 0 }}>
            <table className="admin-table">
              <thead><tr><th>Name</th><th>Role</th><th className="num">Pieces</th><th /></tr></thead>
              <tbody>
                {authors.map((author) => (
                  <tr key={author.id}>
                    <td className="title-cell">{author.displayName}<div className="meta" style={{ marginTop: '0.2rem' }}>/{author.slug}</div></td>
                    <td className="muted-cell">{author.roleTitle ?? '—'}</td>
                    <td className="num">{author.articleCount}</td>
                    <td><a className="btn btn--ghost btn--small" href={`/admin/authors/${author.id}`}>Edit</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card" style={{ gridColumn: 'span 5' }}>
          <h2>New author</h2>
          <form method="post" action="/admin/authors" className="admin-form">
            <CsrfField token={session.csrfToken} />
            <div className="field">
              <label htmlFor="displayName">Display name</label>
              <input className="input" id="displayName" name="displayName" required maxLength={80} />
            </div>
            <div className="field">
              <label htmlFor="roleTitle">Role</label>
              <input className="input" id="roleTitle" name="roleTitle" placeholder="Contributing editor" maxLength={60} />
            </div>
            <div className="field">
              <label htmlFor="bio">Short biography</label>
              <textarea className="textarea" id="bio" name="bio" rows={2} maxLength={300} />
            </div>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">Create author</button>
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
      socials = Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    }
  } catch {
    socials = {}
  }

  return (
    <AdminLayout
      user={user}
      path="/admin/authors"
      title={author.displayName}
      subtitle={`Author · /author/${author.slug}`}
      actions={<a className="btn btn--ghost" href={`/author/${author.slug}`} target="_blank" rel="noopener">View profile ↗</a>}
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
                <label htmlFor="displayName">Display name</label>
                <input className="input" id="displayName" name="displayName" defaultValue={author.displayName} required />
              </div>
              <div className="field">
                <label htmlFor="roleTitle">Role</label>
                <input className="input" id="roleTitle" name="roleTitle" defaultValue={author.roleTitle ?? ''} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="slug">Slug</label>
              <input className="input" id="slug" name="slug" defaultValue={author.slug} required />
            </div>
            <div className="field">
              <label htmlFor="bio">Short biography</label>
              <textarea className="textarea" id="bio" name="bio" rows={2} defaultValue={author.bio} maxLength={300} />
            </div>
            <div className="field">
              <label htmlFor="longBio">Long biography</label>
              <textarea className="textarea" id="longBio" name="longBio" rows={5} defaultValue={author.longBio ?? ''} maxLength={2000} />
            </div>
            <div className="field">
              <label htmlFor="expertise">Expertise (comma separated)</label>
              <input className="input" id="expertise" name="expertise" defaultValue={expertise.join(', ')} />
            </div>
            <div className="field">
              <label htmlFor="website">Website</label>
              <input className="input" id="website" name="website" type="url" defaultValue={socials.website ?? ''} placeholder="https://" />
            </div>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">Save author</button>
            </div>
          </form>
        </section>
        <aside className="admin-card" style={{ gridColumn: 'span 4' }}>
          <h2>Notes</h2>
          <p className="hint">
            Profiles are independent of login accounts. Removing an author requires reassigning their articles first.
          </p>
          <h2 style={{ marginTop: '1.5rem' }}>Danger zone</h2>
          <form method="post" action={`/admin/authors/${author.id}/delete`} data-confirm="Delete this author? Authors with articles cannot be deleted.">
            <CsrfField token={session.csrfToken} />
            <button className="btn btn--danger" type="submit">Delete author</button>
          </form>
        </aside>
      </div>
    </AdminLayout>
  )
}
