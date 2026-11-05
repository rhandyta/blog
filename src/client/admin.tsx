import '../styles/base.css'
import '../styles/admin.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { createLowlight, common } from 'lowlight'
import { Node, mergeAttributes } from '@tiptap/core'
import type { Editor } from '@tiptap/react'
import type { AdminMediaSummary, EditorArticleState, EditorProps, MediaPageProps } from '../lib/admin/types'
import type { PMDoc, PMNode } from '../lib/content/doc'

const lowlight = createLowlight(common)

const CaptionedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-media-id'),
        renderHTML: (attributes) => (attributes.mediaId ? { 'data-media-id': attributes.mediaId } : {}),
      },
      caption: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-caption'),
        renderHTML: (attributes) => (attributes.caption ? { 'data-caption': attributes.caption } : {}),
      },
    }
  },
})

const Embed = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      provider: { default: 'youtube' },
      src: { default: '' },
      id: { default: '' },
      caption: { default: '' },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-embed]' }]
  },
  renderHTML({ HTMLAttributes }) {
    const label = `${HTMLAttributes.provider === 'vimeo' ? 'Vimeo' : 'YouTube'} embed${
      HTMLAttributes.caption ? ` — ${HTMLAttributes.caption}` : ''
    }`
    return ['div', mergeAttributes({ 'data-embed': '', class: 'embed-node' }), label]
  },
})

const extensions = [
  StarterKit.configure({ codeBlock: false, heading: { levels: [1, 2, 3, 4, 5, 6] } }),
  Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
  Underline,
  CaptionedImage.configure({ inline: false, allowBase64: false }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  Placeholder.configure({ placeholder: 'Write the opening paragraph…' }),
  CharacterCount,
  CodeBlockLowlight.configure({ lowlight }),
  Embed,
]

type ToastTone = 'success' | 'error'
type Toast = { id: number; tone: ToastTone; message: string }
type ApiResult<T> = { ok: boolean; status: number; data: T | null; error?: string }

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    const toast = { id: Date.now() + Math.random(), tone, message }
    setToasts((current) => [...current, toast])
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== toast.id))
    }, 4200)
  }, [])
  const stack = (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast" data-tone={toast.tone}>
          {toast.message}
        </div>
      ))}
    </div>
  )
  return { show, stack }
}

function readProps<T>(): T | null {
  const node = document.getElementById('admin-props')
  if (!node) return null
  try {
    return JSON.parse(node.textContent ?? '{}') as T
  } catch {
    return null
  }
}

function hydrateImages(doc: PMDoc, media: AdminMediaSummary[]): PMDoc {
  const byId = new Map(media.map((item) => [item.id, item]))
  const walk = (node: PMNode): PMNode => {
    if (node.type === 'image') {
      const mediaId = typeof node.attrs?.mediaId === 'string' ? node.attrs.mediaId : null
      const item = mediaId ? byId.get(mediaId) : undefined
      if (item) {
        return {
          ...node,
          attrs: {
            ...node.attrs,
            src: node.attrs?.src || item.src,
            alt: node.attrs?.alt || item.alt,
            caption: node.attrs?.caption ?? item.caption ?? '',
          },
        }
      }
      return node
    }
    return node.content ? { ...node, content: node.content.map(walk) } : node
  }
  return { ...doc, content: (doc.content ?? []).map(walk) }
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'untitled'
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

async function api<T>(
  url: string,
  options: { method?: string; body?: unknown; csrfToken: string; formData?: FormData } = { csrfToken: '' },
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { 'x-csrf-token': options.csrfToken, Accept: 'application/json' }
  let body: BodyInit | undefined
  if (options.formData) {
    body = options.formData
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }
  try {
    const response = await fetch(url, {
      method: options.method ?? (body ? 'POST' : 'GET'),
      headers,
      body,
    })
    let data: unknown = null
    try {
      data = await response.json()
    } catch {
      data = null
    }
    if (response.ok) return { ok: true, status: response.status, data: data as T }
    const payload = (data ?? {}) as { error?: string }
    return { ok: false, status: response.status, data: data as T, error: payload.error ?? `Request failed (${response.status})` }
  } catch {
    return { ok: false, status: 0, data: null, error: 'The connection failed. Please try again.' }
  }
}

function StatusBadge({ status }: { status: EditorArticleState['status'] }) {
  return <span className="status" data-status={status}>{status}</span>
}

function ToolbarButton({
  active,
  label,
  title,
  onClick,
  disabled,
}: {
  active?: boolean
  label: string
  title: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active ? 'true' : 'false'}
      data-active={active ? 'true' : 'false'}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  )
}

function MediaPicker({
  open,
  title,
  media,
  csrfToken,
  onClose,
  onSelect,
  onUploaded,
}: {
  open: boolean
  title: string
  media: AdminMediaSummary[]
  csrfToken: string
  onClose: () => void
  onSelect: (media: AdminMediaSummary) => void
  onUploaded: (media: AdminMediaSummary) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return media
    return media.filter(
      (item) =>
        (item.originalName ?? '').toLowerCase().includes(needle) || item.alt.toLowerCase().includes(needle),
    )
  }, [media, query])

  async function upload(file: File) {
    setUploading(true)
    setError(null)
    const formData = new FormData()
    formData.append('file', file)
    const result = await api<{ media: AdminMediaSummary }>('/api/admin/media', { csrfToken, formData })
    setUploading(false)
    if (!result.ok || !result.data) {
      setError(result.error ?? 'Upload failed.')
      return
    }
    onUploaded(result.data.media)
    onSelect(result.data.media)
  }

  return (
    <dialog
      ref={dialogRef}
      className="admin-dialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <div className="admin-dialog__head">
        <h2>{title}</h2>
        <button className="btn btn--ghost btn--small" type="button" onClick={onClose}>Close</button>
      </div>
      <div className="admin-dialog__body">
        <div className="filter-bar" style={{ marginBottom: '1rem' }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="media-search">Search library</label>
            <input
              className="input"
              id="media-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filename or alt text"
            />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void upload(file)
              event.target.value = ''
            }}
          />
          <button className="btn btn--ghost btn--small" type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Upload image'}
          </button>
        </div>
        {error ? <div className="flash" data-tone="error">{error}</div> : null}
        {filtered.length ? (
          <div className="media-grid">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                className="media-item"
                onClick={() => onSelect(item)}
                style={{ textAlign: 'left' }}
              >
                <span className="media-item__image">
                  <img src={item.src} alt={item.alt} loading="lazy" />
                </span>
                <span className="media-item__body">
                  <span className="media-item__alt">{item.alt || 'No alt text'}</span>
                  <span className="media-item__name">{item.originalName ?? item.id}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="hint">No media yet. Upload an image to get started.</p>
        )}
      </div>
    </dialog>
  )
}

function LinkDialog({
  open,
  initialHref,
  onClose,
  onApply,
}: {
  open: boolean
  initialHref: string
  onClose: () => void
  onApply: (href: string) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [href, setHref] = useState(initialHref)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      setHref(initialHref)
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) {
      dialog.close()
    }
  }, [open, initialHref])

  return (
    <dialog ref={dialogRef} className="admin-dialog" style={{ width: 'min(30rem, calc(100vw - 2rem))' }} onClose={onClose}>
      <div className="admin-dialog__head">
        <h2>Link</h2>
        <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>Close</button>
      </div>
      <form
        className="admin-dialog__body"
        onSubmit={(event) => {
          event.preventDefault()
          onApply(href.trim())
        }}
      >
        <div className="field">
          <label htmlFor="link-href">Destination</label>
          <input
            className="input"
            id="link-href"
            value={href}
            onChange={(event) => setHref(event.target.value)}
            placeholder="https://example.com or /articles/slug"
            autoFocus
          />
          <p className="hint">Leave empty to remove the link.</p>
        </div>
        <div className="form-actions">
          <button className="btn btn--solid" type="submit">Apply link</button>
        </div>
      </form>
    </dialog>
  )
}

function EmbedDialog({
  open,
  onClose,
  onApply,
}: {
  open: boolean
  onClose: () => void
  onApply: (value: { provider: string; id: string; src: string; caption: string }) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [url, setUrl] = useState('')
  const [caption, setCaption] = useState('')
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={dialogRef} className="admin-dialog" style={{ width: 'min(34rem, calc(100vw - 2rem))' }} onClose={onClose}>
      <div className="admin-dialog__head">
        <h2>Embed media</h2>
        <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>Close</button>
      </div>
      <form
        className="admin-dialog__body"
        onSubmit={(event) => {
          event.preventDefault()
          const youtube = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{6,20})/)
          if (youtube) {
            onApply({ provider: 'youtube', id: youtube[1], src: url, caption })
          } else {
            const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d{5,12})/)
            onApply({ provider: vimeo ? 'vimeo' : 'youtube', id: vimeo?.[1] ?? '', src: url, caption })
          }
        }}
      >
        <div className="field">
          <label htmlFor="embed-url">YouTube or Vimeo address</label>
          <input className="input" id="embed-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" required autoFocus />
        </div>
        <div className="field" style={{ marginTop: '1rem' }}>
          <label htmlFor="embed-caption">Caption (optional)</label>
          <input className="input" id="embed-caption" value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={200} />
        </div>
        <div className="form-actions">
          <button className="btn btn--solid" type="submit" disabled={!url.trim()}>Insert embed</button>
        </div>
      </form>
    </dialog>
  )
}

function ArticleEditor({ props }: { props: EditorProps }) {
  const { show, stack } = useToasts()
  const initial = props.article
  const [articleId, setArticleId] = useState<string | null>(initial?.id ?? null)
  const [previewToken, setPreviewToken] = useState<string | null>(props.previewToken)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? '')
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug))
  const [status, setStatus] = useState<EditorArticleState['status']>(initial?.status ?? 'draft')
  const [publishedAt, setPublishedAt] = useState<string | null>(initial?.publishedAt ?? null)
  const [scheduledFor, setScheduledFor] = useState<string | null>(initial?.scheduledFor ?? null)
  const [scheduleValue, setScheduleValue] = useState(
    initial?.scheduledFor ? new Date(initial.scheduledFor).toISOString().slice(0, 16) : '',
  )
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null)
  const [authorId, setAuthorId] = useState(initial?.authorId ?? props.defaultAuthorId ?? '')
  const [tagIds, setTagIds] = useState<string[]>(initial?.tags ?? [])
  const [featuredMediaId, setFeaturedMediaId] = useState<string | null>(initial?.featuredMediaId ?? null)
  const [featuredCaption, setFeaturedCaption] = useState(initial?.featuredCaption ?? '')
  const [ogMediaId, setOgMediaId] = useState<string | null>(initial?.ogMediaId ?? null)
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false)
  const [featuredRank, setFeaturedRank] = useState<number | null>(initial?.featuredRank ?? null)
  const [isEditorsPick, setIsEditorsPick] = useState(initial?.isEditorsPick ?? false)
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle ?? '')
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription ?? '')
  const [canonicalUrl, setCanonicalUrl] = useState(initial?.canonicalUrl ?? '')
  const [noIndex, setNoIndex] = useState(initial?.noIndex ?? false)
  const [updatedAt, setUpdatedAt] = useState<string | null>(initial?.updatedAt ?? null)
  const [media, setMedia] = useState<AdminMediaSummary[]>(props.media)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<'saved' | 'dirty' | 'saving' | 'error' | 'conflict'>('saved')
  const [picker, setPicker] = useState<null | 'featured' | 'og' | 'inline'>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [embedOpen, setEmbedOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{ pos: number; alt: string; caption: string } | null>(null)
  const [tagFilter, setTagFilter] = useState('')
  const [deleteArmed, setDeleteArmed] = useState(false)

  const dirtyRef = useRef(dirty)
  const savingRef = useRef(saving)
  const idRef = useRef(articleId)
  const saveLatest = useRef<(options?: { autosave?: boolean; silent?: boolean }) => Promise<string | null>>(async () => null)
  dirtyRef.current = dirty
  savingRef.current = saving
  idRef.current = articleId

  const markDirty = useCallback(() => {
    setDirty(true)
    setSaveMessage('dirty')
  }, [])

  const editor = useEditor({
    extensions,
    content: hydrateImages(initial?.body ?? { type: 'doc', content: [{ type: 'paragraph' }] }, props.media),
    onUpdate: () => markDirty(),
    editorProps: {
      attributes: { class: 'article-editor', spellcheck: 'true' },
    },
  })

  useEffect(() => {
    if (!editor) return
    const updateSelection = () => {
      const { selection } = editor.state
      const node = (selection as unknown as { node?: { type: { name: string }; attrs: Record<string, unknown> } }).node
      if (node && node.type.name === 'image') {
        setSelectedImage({
          pos: selection.from,
          alt: typeof node.attrs.alt === 'string' ? node.attrs.alt : '',
          caption: typeof node.attrs.caption === 'string' ? node.attrs.caption : '',
        })
      } else {
        setSelectedImage(null)
      }
    }
    editor.on('selectionUpdate', updateSelection)
    return () => {
      editor.off('selectionUpdate', updateSelection)
    }
  }, [editor])

  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const featured = media.find((item) => item.id === featuredMediaId) ?? null
  const og = media.find((item) => item.id === ogMediaId) ?? null
  const words = editor?.storage.characterCount.words() ?? 0
  const minutes = Math.max(1, Math.round(words / 220))
  const currentSlug = slug || slugify(title)
  const seoPreviewTitle = seoTitle || title || 'Untitled article'
  const seoPreviewDescription = seoDescription || excerpt || subtitle || 'A description will appear here.'
  const previewUrl = articleId
    ? `${props.siteOrigin.replace(/\/$/, '')}/preview/${articleId}${previewToken ? `?token=${encodeURIComponent(previewToken)}` : ''}`
    : null

  const buildPayload = useCallback(
    () => ({
      title: title.trim() || 'Untitled article',
      subtitle: subtitle.trim() || null,
      excerpt: excerpt.trim() || null,
      slug: currentSlug,
      body: editor?.getJSON() ?? { type: 'doc', content: [{ type: 'paragraph' }] },
      categoryId: categoryId || null,
      authorId: authorId || null,
      featuredMediaId,
      featuredCaption: featuredCaption.trim() || null,
      ogMediaId,
      isFeatured,
      featuredRank,
      isEditorsPick,
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      canonicalUrl: canonicalUrl.trim() || null,
      noIndex,
      tagIds,
      status: status === 'published' ? 'published' : 'draft',
      updatedAt,
    }),
    [
      title, subtitle, excerpt, currentSlug, editor, categoryId, authorId, featuredMediaId, featuredCaption,
      ogMediaId, isFeatured, featuredRank, isEditorsPick, seoTitle, seoDescription, canonicalUrl, noIndex,
      tagIds, status, updatedAt,
    ],
  )

  const save = useCallback(
    async (options: { autosave?: boolean; silent?: boolean } = {}): Promise<string | null> => {
      if (savingRef.current) return idRef.current
      setSaving(true)
      savingRef.current = true
      if (!options.silent) setSaveMessage('saving')
      const payload = buildPayload()
      const isNew = !idRef.current
      const url = isNew
        ? '/api/admin/articles'
        : options.autosave
          ? `/api/admin/articles/${idRef.current}/autosave`
          : `/api/admin/articles/${idRef.current}`
      const result = await api<{
        article: { id: string; slug: string; status: EditorArticleState['status']; updatedAt: string; publishedAt: string | null; scheduledFor: string | null }
        previewToken: string
      }>(url, {
        method: isNew ? 'POST' : options.autosave ? 'POST' : 'PUT',
        body: payload,
        csrfToken: props.csrfToken,
      })
      setSaving(false)
      savingRef.current = false
      if (!result.ok || !result.data) {
        setSaveMessage(result.status === 409 ? 'conflict' : 'error')
        if (!options.silent) show(result.error ?? 'Could not save the article.', 'error')
        return null
      }
      const article = result.data.article
      if (isNew) {
        setArticleId(article.id)
        idRef.current = article.id
        window.history.replaceState({}, '', `/admin/articles/${article.id}/edit`)
        setDirty(false)
      } else {
        setDirty(false)
      }
      setSlug(article.slug)
      setUpdatedAt(article.updatedAt)
      setStatus(article.status)
      setPublishedAt(article.publishedAt)
      setScheduledFor(article.scheduledFor)
      setPreviewToken(result.data.previewToken)
      setSaveMessage('saved')
      if (!options.silent) show(options.autosave ? 'Autosaved.' : 'Saved.')
      return article.id
    },
    [buildPayload, props.csrfToken, show],
  )
  saveLatest.current = save

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (dirtyRef.current && idRef.current && !savingRef.current) {
        void saveLatest.current({ autosave: true, silent: true })
      }
    }, 20000)
    return () => window.clearInterval(timer)
  }, [])

  async function ensureSaved(): Promise<string | null> {
    if (!idRef.current) {
      const id = await save({ silent: false })
      return id
    }
    if (dirtyRef.current) await save({ silent: false })
    return idRef.current
  }

  async function publish() {
    const id = await ensureSaved()
    if (!id) return
    const result = await api<{ article: { status: EditorArticleState['status']; publishedAt: string | null } }>(
      `/api/admin/articles/${id}/publish`,
      { method: 'POST', csrfToken: props.csrfToken },
    )
    if (!result.ok) {
      show(result.error ?? 'Could not publish.', 'error')
      return
    }
    setStatus('published')
    setPublishedAt(result.data?.article.publishedAt ?? new Date().toISOString())
    setDirty(false)
    setSaveMessage('saved')
    show('Published. The article is live.')
  }

  async function unpublish() {
    const id = await ensureSaved()
    if (!id) return
    const result = await api<{ article: { status: EditorArticleState['status']; publishedAt: string | null } }>(
      `/api/admin/articles/${id}/unpublish`,
      { method: 'POST', csrfToken: props.csrfToken },
    )
    if (!result.ok) {
      show(result.error ?? 'Could not unpublish.', 'error')
      return
    }
    setStatus('draft')
    setPublishedAt(null)
    show('Moved back to draft.')
  }

  async function archive() {
    const id = await ensureSaved()
    if (!id) return
    const result = await api(`/api/admin/articles/${id}/archive`, { method: 'POST', csrfToken: props.csrfToken })
    if (!result.ok) {
      show(result.error ?? 'Could not archive.', 'error')
      return
    }
    setStatus('archived')
    show('Archived.')
  }

  async function schedule() {
    if (!scheduleValue) {
      show('Choose a date and time first.', 'error')
      return
    }
    const id = await ensureSaved()
    if (!id) return
    const iso = new Date(scheduleValue).toISOString()
    const result = await api<{ article: { status: EditorArticleState['status']; scheduledFor: string | null } }>(
      `/api/admin/articles/${id}/schedule`,
      { method: 'POST', body: { scheduledFor: iso }, csrfToken: props.csrfToken },
    )
    if (!result.ok) {
      show(result.error ?? 'Could not schedule.', 'error')
      return
    }
    setStatus('scheduled')
    setScheduledFor(iso)
    show(`Scheduled for ${new Date(iso).toLocaleString('en-GB')}.`)
  }

  async function openPreview() {
    // Open the tab synchronously so pop-up blockers see a user gesture, then
    // point it at the saved preview once the save completes.
    const popup = window.open('about:blank', '_blank')
    if (popup) popup.opener = null
    const id = await ensureSaved()
    if (!id) {
      popup?.close()
      return
    }
    const url = `${props.siteOrigin.replace(/\/$/, '')}/preview/${id}${
      previewToken ? `?token=${encodeURIComponent(previewToken)}` : ''
    }`
    if (popup) popup.location.href = url
    else window.open(url, '_blank', 'noopener')
  }

  async function removeArticle() {
    if (!articleId) return
    const result = await api(`/api/admin/articles/${articleId}`, { method: 'DELETE', csrfToken: props.csrfToken })
    if (!result.ok) {
      show(result.error ?? 'Could not delete.', 'error')
      return
    }
    window.location.href = '/admin/articles?flash=deleted'
  }

  function onMediaPicked(item: AdminMediaSummary) {
    if (picker === 'featured') setFeaturedMediaId(item.id)
    if (picker === 'og') setOgMediaId(item.id)
    if (picker === 'inline' && editor) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'image',
          attrs: { mediaId: item.id, src: item.src, alt: item.alt, caption: item.caption ?? '' },
        })
        .run()
    }
    setPicker(null)
  }

  function updateImageAttributes(patch: { alt?: string; caption?: string }) {
    if (!editor) return
    editor.chain().focus().updateAttributes('image', patch).run()
  }

  const filteredTags = tagFilter
    ? props.tags.filter((tag) => tag.name.toLowerCase().includes(tagFilter.toLowerCase()))
    : props.tags

  const headingValue = editor?.isActive('heading')
    ? String(editor.getAttributes('heading').level ?? 2)
    : 'p'

  return (
    <>
      <div className="editor-topbar">
        <div className="editor-topbar__left">
          <a className="text-link" href="/admin/articles" style={{ flex: 'none' }}>← Articles</a>
          <StatusBadge status={status} />
          <span className="editor-topbar__title">{title || 'Untitled article'}</span>
        </div>
        <div className="editor-save-state" data-tone={saveMessage === 'error' ? 'error' : saveMessage === 'saved' ? 'saved' : undefined}>
          {saveMessage === 'saving' ? 'Saving…' : saveMessage === 'dirty' ? 'Unsaved changes' : saveMessage === 'conflict' ? 'Conflict — reload' : saveMessage === 'error' ? 'Save failed' : 'Saved'}
        </div>
        <div className="editor-topbar__actions">
          <button className="btn btn--ghost btn--small" type="button" onClick={() => void openPreview()}>Preview</button>
          <button className="btn btn--ghost btn--small" type="button" onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {status === 'published' ? (
            <button className="btn btn--small" type="button" onClick={() => void unpublish()}>Unpublish</button>
          ) : (
            <button className="btn btn--solid btn--small" type="button" onClick={() => void publish()}>Publish</button>
          )}
        </div>
      </div>

      <div className="editor-grid">
        <div className="editor-main">
          {saveMessage === 'conflict' ? (
            <div className="flash" data-tone="error" role="alert" style={{ marginBottom: '1rem' }}>
              This article changed in another session. Reload the page to fetch the latest version before saving again.
            </div>
          ) : null}
          <input
            className="title-input"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              if (!slugTouched) setSlug(slugify(event.target.value))
              markDirty()
            }}
            placeholder="The headline"
            aria-label="Article title"
          />
          <input
            className="subtitle-input"
            value={subtitle}
            onChange={(event) => {
              setSubtitle(event.target.value)
              markDirty()
            }}
            placeholder="A deck or subtitle — one sentence"
            aria-label="Article subtitle"
          />

          {selectedImage ? (
            <div className="admin-card" style={{ marginBottom: '1rem', padding: '0.9rem' }}>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="image-alt">Image alt text</label>
                  <input
                    className="input"
                    id="image-alt"
                    value={selectedImage.alt}
                    onChange={(event) => {
                      setSelectedImage({ ...selectedImage, alt: event.target.value })
                      updateImageAttributes({ alt: event.target.value })
                    }}
                  />
                </div>
                <div className="field">
                  <label htmlFor="image-caption">Caption</label>
                  <input
                    className="input"
                    id="image-caption"
                    value={selectedImage.caption}
                    onChange={(event) => {
                      setSelectedImage({ ...selectedImage, caption: event.target.value })
                      updateImageAttributes({ caption: event.target.value })
                    }}
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div className="editor-toolbar" role="toolbar" aria-label="Formatting">
            <select
              aria-label="Paragraph style"
              value={headingValue}
              onChange={(event) => {
                const value = event.target.value
                if (!editor) return
                if (value === 'p') editor.chain().focus().setParagraph().run()
                else editor.chain().focus().toggleHeading({ level: Number(value) as 1 | 2 | 3 | 4 | 5 | 6 }).run()
              }}
            >
              <option value="p">Paragraph</option>
              <option value="1">Heading 1</option>
              <option value="2">Heading 2</option>
              <option value="3">Heading 3</option>
              <option value="4">Heading 4</option>
              <option value="5">Heading 5</option>
              <option value="6">Heading 6</option>
            </select>
            <span className="divider" />
            <ToolbarButton label="B" title="Bold" active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()} />
            <ToolbarButton label="I" title="Italic" active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()} />
            <ToolbarButton label="U" title="Underline" active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()} />
            <ToolbarButton label="S" title="Strikethrough" active={editor?.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()} />
            <ToolbarButton label="`" title="Inline code" active={editor?.isActive('code')} onClick={() => editor?.chain().focus().toggleCode().run()} />
            <span className="divider" />
            <ToolbarButton label="•" title="Bullet list" active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()} />
            <ToolbarButton label="1." title="Ordered list" active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()} />
            <ToolbarButton label="❝" title="Blockquote" active={editor?.isActive('blockquote')} onClick={() => editor?.chain().focus().toggleBlockquote().run()} />
            <ToolbarButton label="</>" title="Code block" active={editor?.isActive('codeBlock')} onClick={() => editor?.chain().focus().toggleCodeBlock().run()} />
            <span className="divider" />
            <ToolbarButton
              label="Link"
              title="Add or edit link"
              active={editor?.isActive('link')}
              onClick={() => setLinkOpen(true)}
            />
            <ToolbarButton label="Image" title="Insert image from the library" onClick={() => setPicker('inline')} />
            <ToolbarButton
              label="Table"
              title="Insert table"
              onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            />
            <ToolbarButton label="Embed" title="Embed YouTube or Vimeo" onClick={() => setEmbedOpen(true)} />
            <ToolbarButton label="—" title="Horizontal rule" onClick={() => editor?.chain().focus().setHorizontalRule().run()} />
            <span className="divider" />
            <ToolbarButton label="↶" title="Undo" onClick={() => editor?.chain().focus().undo().run()} />
            <ToolbarButton label="↷" title="Redo" onClick={() => editor?.chain().focus().redo().run()} />
          </div>

          <div className="editor-surface">
            <EditorContent editor={editor} />
          </div>
          <div className="editor-meta">
            <span>{words} words · {minutes} min read</span>
            <span>{editor?.storage.characterCount.characters() ?? 0} characters</span>
          </div>
        </div>

        <aside className="editor-side">
          <section className="editor-side__section">
            <h2>Publishing</h2>
            <div className="field">
              <label>Status</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <StatusBadge status={status} />
                <span className="meta">
                  {publishedAt ? `Published ${formatShortDate(publishedAt)}` : scheduledFor ? `Scheduled ${formatShortDate(scheduledFor)}` : 'Not public'}
                </span>
              </div>
            </div>
            <div className="field">
              <label htmlFor="schedule">Schedule</label>
              <input
                className="input"
                id="schedule"
                type="datetime-local"
                value={scheduleValue}
                onChange={(event) => setScheduleValue(event.target.value)}
              />
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                <button className="btn btn--ghost btn--small" type="button" onClick={() => void schedule()}>Schedule</button>
                <button className="btn btn--ghost btn--small" type="button" onClick={() => void archive()}>Archive</button>
              </div>
            </div>
            {status === 'published' ? (
              <a className="text-link" href={`/articles/${currentSlug}`} target="_blank" rel="noopener">View live article →</a>
            ) : null}
            {previewUrl ? (
              <a className="text-link" href={previewUrl} target="_blank" rel="noopener">Open preview →</a>
            ) : null}
          </section>

          <section className="editor-side__section">
            <h2>Organisation</h2>
            <div className="field">
              <label htmlFor="category">Section</label>
              <select
                className="select"
                id="category"
                value={categoryId ?? ''}
                onChange={(event) => {
                  setCategoryId(event.target.value || null)
                  markDirty()
                }}
              >
                <option value="">Uncategorised</option>
                {props.categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="author">Author</label>
              <select
                className="select"
                id="author"
                value={authorId}
                onChange={(event) => {
                  setAuthorId(event.target.value)
                  markDirty()
                }}
              >
                {props.authors.map((author) => (
                  <option key={author.id} value={author.id}>{author.displayName}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="tag-filter">Tags</label>
              <input
                className="input"
                id="tag-filter"
                value={tagFilter}
                onChange={(event) => setTagFilter(event.target.value)}
                placeholder="Filter tags"
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.45rem', maxHeight: '9rem', overflowY: 'auto' }}>
                {filteredTags.map((tag) => {
                  const active = tagIds.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      className="tag"
                      aria-pressed={active}
                      style={active ? { borderColor: 'var(--ink)', background: 'var(--paper-3)' } : undefined}
                      onClick={() => {
                        setTagIds((current) => (active ? current.filter((id) => id !== tag.id) : [...current, tag.id]))
                        markDirty()
                      }}
                    >
                      {tag.name}
                    </button>
                  )
                })}
                {!filteredTags.length ? <span className="hint">No tags match.</span> : null}
              </div>
            </div>
          </section>

          <section className="editor-side__section">
            <h2>Featured image</h2>
            <div className="media-preview">
              {featured ? <img src={featured.src} alt={featured.alt} /> : null}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn--ghost btn--small" type="button" onClick={() => setPicker('featured')}>
                {featured ? 'Change image' : 'Choose image'}
              </button>
              {featured ? (
                <button className="btn btn--ghost btn--small" type="button" onClick={() => { setFeaturedMediaId(null); markDirty() }}>Remove</button>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="featured-caption">Caption</label>
              <input
                className="input"
                id="featured-caption"
                value={featuredCaption}
                onChange={(event) => { setFeaturedCaption(event.target.value); markDirty() }}
                placeholder="Optional caption shown beneath the image"
              />
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={isFeatured} onChange={(event) => { setIsFeatured(event.target.checked); markDirty() }} />
              <span>Feature on the homepage<small>Ranked by the number below</small></span>
            </label>
            <div className="field">
              <label htmlFor="featured-rank">Feature rank</label>
              <input
                className="input"
                id="featured-rank"
                type="number"
                min={0}
                max={99}
                value={featuredRank ?? ''}
                onChange={(event) => { setFeaturedRank(event.target.value ? Number(event.target.value) : null); markDirty() }}
              />
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={isEditorsPick} onChange={(event) => { setIsEditorsPick(event.target.checked); markDirty() }} />
              <span>Include in Editors’ picks</span>
            </label>
          </section>

          <section className="editor-side__section">
            <h2>Excerpt</h2>
            <textarea
              className="textarea"
              value={excerpt}
              onChange={(event) => { setExcerpt(event.target.value); markDirty() }}
              placeholder="A short summary used on listings, search results, and social cards."
              rows={4}
              maxLength={600}
            />
          </section>

          <section className="editor-side__section">
            <h2>SEO &amp; sharing</h2>
            <div className="field">
              <label htmlFor="slug">Slug</label>
              <input
                className="input"
                id="slug"
                value={slug}
                onChange={(event) => { setSlug(slugify(event.target.value)); setSlugTouched(true); markDirty() }}
              />
              <p className="hint">/articles/{currentSlug}</p>
            </div>
            <div className="field">
              <label htmlFor="seo-title">SEO title</label>
              <input
                className="input"
                id="seo-title"
                value={seoTitle}
                onChange={(event) => { setSeoTitle(event.target.value); markDirty() }}
                placeholder={title || 'Defaults to the headline'}
                maxLength={200}
              />
            </div>
            <div className="field">
              <label htmlFor="seo-description">Meta description</label>
              <textarea
                className="textarea"
                id="seo-description"
                value={seoDescription}
                onChange={(event) => { setSeoDescription(event.target.value); markDirty() }}
                placeholder={excerpt || 'Defaults to the excerpt'}
                rows={3}
                maxLength={400}
              />
              <p className="hint">{seoDescription.length}/400</p>
            </div>
            <div className="field">
              <label htmlFor="canonical">Canonical URL</label>
              <input
                className="input"
                id="canonical"
                value={canonicalUrl}
                onChange={(event) => { setCanonicalUrl(event.target.value); markDirty() }}
                placeholder="https://"
              />
            </div>
            <div className="field">
              <label>Social image</label>
              <div className="media-preview" style={{ aspectRatio: '1200 / 630' }}>
                {og ? <img src={og.src} alt={og.alt} /> : featured ? <img src={featured.src} alt={featured.alt} /> : null}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn--ghost btn--small" type="button" onClick={() => setPicker('og')}>
                  {og ? 'Change image' : 'Choose image'}
                </button>
                {og ? (
                  <button className="btn btn--ghost btn--small" type="button" onClick={() => { setOgMediaId(null); markDirty() }}>Use featured</button>
                ) : null}
              </div>
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={noIndex} onChange={(event) => { setNoIndex(event.target.checked); markDirty() }} />
              <span>Exclude from search engines<small>Adds noindex to the article and removes it from the sitemap</small></span>
            </label>

            <div className="seo-preview">
              <div className="seo-preview__url">{props.siteOrigin.replace(/^https?:\/\//, '')}/articles/{currentSlug}</div>
              <div className="seo-preview__title">{seoPreviewTitle}</div>
              <div className="seo-preview__desc">{seoPreviewDescription}</div>
            </div>

            <div className="og-preview">
              <div className="og-preview__image">
                {og ? <img src={og.src} alt="" /> : featured ? <img src={featured.src} alt="" /> : null}
              </div>
              <div className="og-preview__body">
                <div className="og-preview__domain">{props.siteOrigin.replace(/^https?:\/\//, '').split('/')[0]}</div>
                <div className="og-preview__title">{seoPreviewTitle}</div>
                <div className="og-preview__desc">{seoPreviewDescription}</div>
              </div>
            </div>
          </section>

          {articleId ? (
            <section className="editor-side__section">
              <h2>Danger zone</h2>
              {!deleteArmed ? (
                <button className="btn btn--danger btn--small" type="button" onClick={() => setDeleteArmed(true)}>Delete article</button>
              ) : (
                <div>
                  <p className="hint" style={{ marginBottom: '0.5rem' }}>This permanently removes the article, its revisions, and its view history.</p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn--danger btn--small" type="button" onClick={() => void removeArticle()}>Confirm delete</button>
                    <button className="btn btn--ghost btn--small" type="button" onClick={() => setDeleteArmed(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </section>
          ) : null}
        </aside>
      </div>

      <MediaPicker
        open={picker !== null}
        title={picker === 'og' ? 'Choose a social image' : picker === 'inline' ? 'Insert an image' : 'Choose a featured image'}
        media={media}
        csrfToken={props.csrfToken}
        onClose={() => setPicker(null)}
        onSelect={onMediaPicked}
        onUploaded={(item) => setMedia((current) => [item, ...current])}
      />

      <LinkDialog
        open={linkOpen}
        initialHref={editor?.getAttributes('link').href ?? ''}
        onClose={() => setLinkOpen(false)}
        onApply={(href) => {
          setLinkOpen(false)
          if (!editor) return
          if (!href) {
            editor.chain().focus().unsetLink().run()
          } else {
            const safe = href.startsWith('/') || /^https?:\/\//i.test(href) || href.startsWith('mailto:') ? href : `https://${href}`
            editor.chain().focus().extendMarkRange('link').setLink({ href: safe }).run()
          }
        }}
      />

      <EmbedDialog
        open={embedOpen}
        onClose={() => setEmbedOpen(false)}
        onApply={(value) => {
          setEmbedOpen(false)
          if (!editor) return
          if (!value.id) {
            show('That address was not recognised as a YouTube or Vimeo video.', 'error')
            return
          }
          editor.chain().focus().insertContent({ type: 'embed', attrs: value }).run()
        }}
      />

      {stack}
    </>
  )
}

function MediaLibrary({ props }: { props: MediaPageProps }) {
  const { show, stack } = useToasts()
  const [media, setMedia] = useState<AdminMediaSummary[]>(props.media)
  const [query, setQuery] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Record<string, { alt: string; caption: string }>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return media
    return media.filter(
      (item) =>
        (item.originalName ?? '').toLowerCase().includes(needle) ||
        item.alt.toLowerCase().includes(needle) ||
        (item.caption ?? '').toLowerCase().includes(needle),
    )
  }, [media, query])

  async function uploadFiles(files: FileList | File[]) {
    setError(null)
    const list = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (!list.length) {
      setError('Choose an image file to upload.')
      return
    }
    setUploading(true)
    for (const file of list) {
      const formData = new FormData()
      formData.append('file', file)
      const result = await api<{ media: AdminMediaSummary }>('/api/admin/media', {
        csrfToken: props.csrfToken,
        formData,
      })
      if (!result.ok || !result.data) {
        setError(result.error ?? 'Upload failed.')
        continue
      }
      setMedia((current) => [result.data!.media, ...current])
      show(`Uploaded ${file.name}.`)
    }
    setUploading(false)
  }

  async function saveMetadata(item: AdminMediaSummary) {
    const patch = editing[item.id]
    if (!patch) return
    const result = await api(`/api/admin/media/${item.id}`, {
      method: 'PATCH',
      csrfToken: props.csrfToken,
      body: { alt: patch.alt, caption: patch.caption },
    })
    if (!result.ok) {
      show(result.error ?? 'Could not save the details.', 'error')
      return
    }
    setMedia((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, alt: patch.alt, caption: patch.caption } : entry)),
    )
    show('Image details saved.')
  }

  async function remove(item: AdminMediaSummary) {
    const result = await api(`/api/admin/media/${item.id}`, { method: 'DELETE', csrfToken: props.csrfToken })
    if (!result.ok) {
      show(result.error ?? 'Could not delete the image.', 'error')
      return
    }
    setMedia((current) => current.filter((entry) => entry.id !== item.id))
    show('Image deleted.')
  }

  return (
    <div>
      <div className="filter-bar">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="media-q">Search media</label>
          <input
            className="input"
            id="media-q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filename, alt text, or caption"
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files) void uploadFiles(event.target.files)
            event.target.value = ''
          }}
        />
        <button className="btn btn--solid btn--small" type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload images'}
        </button>
      </div>

      {error ? <div className="flash" data-tone="error">{error}</div> : null}

      <div
        className="upload-zone"
        data-dragging={dragging ? 'true' : 'false'}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (event.dataTransfer.files) void uploadFiles(event.dataTransfer.files)
        }}
        style={{ marginBottom: '1.25rem' }}
      >
        <p>Drop images here, or use the upload button.</p>
        <p className="hint">JPEG, PNG, WebP, GIF, or AVIF · up to 8 MB · processed into WebP and AVIF variants</p>
      </div>

      {filtered.length ? (
        <div className="media-grid">
          {filtered.map((item) => {
            const draft = editing[item.id] ?? { alt: item.alt, caption: item.caption ?? '' }
            return (
              <div className="media-item" key={item.id}>
                <div className="media-item__image">
                  <img src={item.src} alt={item.alt} loading="lazy" />
                </div>
                <div className="media-item__body">
                  <div className="media-item__name">{item.originalName ?? item.id}</div>
                  <input
                    className="input"
                    aria-label={`Alt text for ${item.originalName ?? item.id}`}
                    value={draft.alt}
                    placeholder="Alt text"
                    onChange={(event) =>
                      setEditing((current) => ({ ...current, [item.id]: { ...draft, alt: event.target.value } }))
                    }
                    onBlur={() => void saveMetadata(item)}
                    style={{ padding: '0.4rem 0.5rem', fontSize: '0.82rem' }}
                  />
                  <input
                    className="input"
                    aria-label={`Caption for ${item.originalName ?? item.id}`}
                    value={draft.caption}
                    placeholder="Caption (optional)"
                    onChange={(event) =>
                      setEditing((current) => ({ ...current, [item.id]: { ...draft, caption: event.target.value } }))
                    }
                    onBlur={() => void saveMetadata(item)}
                    style={{ padding: '0.4rem 0.5rem', fontSize: '0.82rem' }}
                  />
                  <div className="media-item__actions">
                    <button
                      className="btn btn--ghost btn--small"
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(item.src)
                          show('Image URL copied.')
                        } catch {
                          show('Could not copy to the clipboard.', 'error')
                        }
                      }}
                    >
                      Copy URL
                    </button>
                    <button className="btn btn--danger btn--small" type="button" onClick={() => void remove(item)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No media yet</h2>
          <p>Upload an image above, then use it in an article or as a featured image.</p>
        </div>
      )}
      {stack}
    </div>
  )
}

function init(): void {
  const rootElement = document.getElementById('admin-root')
  if (!rootElement) return
  const mode = rootElement.dataset.mode
  const props = readProps<EditorProps & MediaPageProps>()
  if (!props) {
    rootElement.textContent = 'The editorial data could not be loaded.'
    return
  }
  const root = createRoot(rootElement)
  if (mode === 'editor') {
    root.render(<ArticleEditor props={props as EditorProps} />)
  } else if (mode === 'media') {
    root.render(<MediaLibrary props={props as MediaPageProps} />)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}

export {}
