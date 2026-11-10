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
import type { AdminMediaSummary, EditorArticleState, EditorProps, MediaPageProps } from '../lib/admin/types'
import type { PMDoc, PMNode } from '../lib/content/doc'
import { I18nProvider, getTranslator, useI18n } from '../lib/i18n'
import { documentLocale } from '../lib/i18n/browser'
import { articleStatusKey } from '../lib/i18n/status'

const translate = getTranslator(documentLocale())
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
  Link.configure({
    openOnClick: false,
    autolink: true,
    HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
  }),
  Underline,
  CaptionedImage.configure({ inline: false, allowBase64: false }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  Placeholder.configure({ placeholder: translate('adminEditor.editor.bodyPlaceholder') }),
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
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90) || 'untitled'
  )
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
    return {
      ok: false,
      status: response.status,
      data: data as T,
      error: payload.error ?? translate('adminEditor.errors.requestFailed', { status: response.status }),
    }
  } catch {
    return { ok: false, status: 0, data: null, error: translate('adminEditor.errors.connectionFailed') }
  }
}

function StatusBadge({ status }: { status: EditorArticleState['status'] }) {
  const { t } = useI18n()
  return (
    <span className="status" data-status={status}>
      {t(articleStatusKey(status))}
    </span>
  )
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
  const { t } = useI18n()
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
      (item) => (item.originalName ?? '').toLowerCase().includes(needle) || item.alt.toLowerCase().includes(needle),
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
      setError(result.error ?? t('adminEditor.mediaPicker.uploadFailed'))
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
        <button className="btn btn--ghost btn--small" type="button" onClick={onClose}>
          {t('adminEditor.mediaPicker.close')}
        </button>
      </div>
      <div className="admin-dialog__body">
        <div className="filter-bar" style={{ marginBottom: '1rem' }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="media-search">{t('adminEditor.mediaPicker.searchLabel')}</label>
            <input
              className="input"
              id="media-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('adminEditor.mediaPicker.searchPlaceholder')}
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
          <button
            className="btn btn--ghost btn--small"
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? t('adminEditor.mediaPicker.uploading') : t('adminEditor.mediaPicker.upload')}
          </button>
        </div>
        {error ? (
          <div className="flash" data-tone="error">
            {error}
          </div>
        ) : null}
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
                  <span className="media-item__alt">{item.alt || t('adminEditor.mediaPicker.noAlt')}</span>
                  <span className="media-item__name">{item.originalName ?? item.id}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="hint">{t('adminEditor.mediaPicker.empty')}</p>
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
  const { t } = useI18n()
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
    <dialog
      ref={dialogRef}
      className="admin-dialog"
      style={{ width: 'min(30rem, calc(100vw - 2rem))' }}
      onClose={onClose}
    >
      <div className="admin-dialog__head">
        <h2>{t('adminEditor.linkDialog.title')}</h2>
        <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>
          {t('adminEditor.linkDialog.close')}
        </button>
      </div>
      <form
        className="admin-dialog__body"
        onSubmit={(event) => {
          event.preventDefault()
          onApply(href.trim())
        }}
      >
        <div className="field">
          <label htmlFor="link-href">{t('adminEditor.linkDialog.destination')}</label>
          <input
            className="input"
            id="link-href"
            value={href}
            onChange={(event) => setHref(event.target.value)}
            placeholder={t('adminEditor.linkDialog.hrefPlaceholder')}
            autoFocus
          />
          <p className="hint">{t('adminEditor.linkDialog.hint')}</p>
        </div>
        <div className="form-actions">
          <button className="btn btn--solid" type="submit">
            {t('adminEditor.linkDialog.apply')}
          </button>
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
  const { t } = useI18n()
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
    <dialog
      ref={dialogRef}
      className="admin-dialog"
      style={{ width: 'min(34rem, calc(100vw - 2rem))' }}
      onClose={onClose}
    >
      <div className="admin-dialog__head">
        <h2>{t('adminEditor.embedDialog.title')}</h2>
        <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>
          {t('adminEditor.embedDialog.close')}
        </button>
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
          <label htmlFor="embed-url">{t('adminEditor.embedDialog.url')}</label>
          <input
            className="input"
            id="embed-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            required
            autoFocus
          />
        </div>
        <div className="field" style={{ marginTop: '1rem' }}>
          <label htmlFor="embed-caption">{t('adminEditor.embedDialog.caption')}</label>
          <input
            className="input"
            id="embed-caption"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            maxLength={200}
          />
        </div>
        <div className="form-actions">
          <button className="btn btn--solid" type="submit" disabled={!url.trim()}>
            {t('adminEditor.embedDialog.insert')}
          </button>
        </div>
      </form>
    </dialog>
  )
}

function ArticleEditor({ props }: { props: EditorProps }) {
  const { show, stack } = useToasts()
  const { t, formatDate } = useI18n()
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
  const [language, setLanguage] = useState(initial?.language ?? '')
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
  const saveLatest = useRef<(options?: { autosave?: boolean; silent?: boolean }) => Promise<string | null>>(
    async () => null,
  )
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
  const seoPreviewTitle = seoTitle || title || t('adminEditor.editor.untitled')
  const seoPreviewDescription = seoDescription || excerpt || subtitle || t('adminEditor.seo.descriptionFallback')
  const previewUrl = articleId
    ? `${props.siteOrigin.replace(/\/$/, '')}/preview/${articleId}${previewToken ? `?token=${encodeURIComponent(previewToken)}` : ''}`
    : null

  const buildPayload = useCallback(
    () => ({
      title: title.trim() || t('adminEditor.editor.untitled'),
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
      language: language === 'id' || language === 'en' ? language : null,
      tagIds,
      status: status === 'published' ? 'published' : 'draft',
      updatedAt,
    }),
    [
      title,
      subtitle,
      excerpt,
      currentSlug,
      editor,
      categoryId,
      authorId,
      featuredMediaId,
      featuredCaption,
      ogMediaId,
      isFeatured,
      featuredRank,
      isEditorsPick,
      seoTitle,
      seoDescription,
      canonicalUrl,
      noIndex,
      language,
      tagIds,
      status,
      updatedAt,
      t,
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
        article: {
          id: string
          slug: string
          status: EditorArticleState['status']
          updatedAt: string
          publishedAt: string | null
          scheduledFor: string | null
        }
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
        if (!options.silent) show(result.error ?? t('adminEditor.toasts.saveFailed'), 'error')
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
      if (!options.silent) show(options.autosave ? t('adminEditor.toasts.autosaved') : t('adminEditor.toasts.saved'))
      return article.id
    },
    [buildPayload, props.csrfToken, show, t],
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
      show(result.error ?? t('adminEditor.toasts.publishFailed'), 'error')
      return
    }
    setStatus('published')
    setPublishedAt(result.data?.article.publishedAt ?? new Date().toISOString())
    setDirty(false)
    setSaveMessage('saved')
    show(t('adminEditor.toasts.published'))
  }

  async function unpublish() {
    const id = await ensureSaved()
    if (!id) return
    const result = await api<{ article: { status: EditorArticleState['status']; publishedAt: string | null } }>(
      `/api/admin/articles/${id}/unpublish`,
      { method: 'POST', csrfToken: props.csrfToken },
    )
    if (!result.ok) {
      show(result.error ?? t('adminEditor.toasts.unpublishFailed'), 'error')
      return
    }
    setStatus('draft')
    setPublishedAt(null)
    show(t('adminEditor.toasts.unpublished'))
  }

  async function archive() {
    const id = await ensureSaved()
    if (!id) return
    const result = await api(`/api/admin/articles/${id}/archive`, { method: 'POST', csrfToken: props.csrfToken })
    if (!result.ok) {
      show(result.error ?? t('adminEditor.toasts.archiveFailed'), 'error')
      return
    }
    setStatus('archived')
    show(t('adminEditor.toasts.archived'))
  }

  async function schedule() {
    if (!scheduleValue) {
      show(t('adminEditor.toasts.scheduleMissing'), 'error')
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
      show(result.error ?? t('adminEditor.toasts.scheduleFailed'), 'error')
      return
    }
    setStatus('scheduled')
    setScheduledFor(iso)
    show(t('adminEditor.toasts.scheduledFor', { date: formatDate(iso, 'datetime') }))
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
      show(result.error ?? t('adminEditor.toasts.deleteFailed'), 'error')
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

  const headingValue = editor?.isActive('heading') ? String(editor.getAttributes('heading').level ?? 2) : 'p'

  return (
    <>
      <div className="editor-topbar">
        <div className="editor-topbar__left">
          <a className="text-link" href="/admin/articles" style={{ flex: 'none' }}>
            ← {t('adminEditor.editor.backToArticles')}
          </a>
          <StatusBadge status={status} />
          <span className="editor-topbar__title">{title || t('adminEditor.editor.untitled')}</span>
        </div>
        <div
          className="editor-save-state"
          data-tone={saveMessage === 'error' ? 'error' : saveMessage === 'saved' ? 'saved' : undefined}
        >
          {saveMessage === 'saving'
            ? t('adminEditor.editor.saving')
            : saveMessage === 'dirty'
              ? t('adminEditor.editor.saveStatusDirty')
              : saveMessage === 'conflict'
                ? t('adminEditor.editor.saveStatusConflict')
                : saveMessage === 'error'
                  ? t('adminEditor.editor.saveStatusError')
                  : t('adminEditor.editor.saveStatusSaved')}
        </div>
        <div className="editor-topbar__actions">
          <button className="btn btn--ghost btn--small" type="button" onClick={() => void openPreview()}>
            {t('adminEditor.editor.preview')}
          </button>
          <button className="btn btn--ghost btn--small" type="button" onClick={() => void save()} disabled={saving}>
            {saving ? t('adminEditor.editor.saving') : t('adminEditor.editor.save')}
          </button>
          {status === 'published' ? (
            <button className="btn btn--small" type="button" onClick={() => void unpublish()}>
              {t('adminEditor.editor.unpublish')}
            </button>
          ) : (
            <button className="btn btn--solid btn--small" type="button" onClick={() => void publish()}>
              {t('adminEditor.editor.publish')}
            </button>
          )}
        </div>
      </div>

      <div className="editor-grid">
        <div className="editor-main">
          {saveMessage === 'conflict' ? (
            <div className="flash" data-tone="error" role="alert" style={{ marginBottom: '1rem' }}>
              {t('adminEditor.editor.conflictNotice')}
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
            placeholder={t('adminEditor.editor.titlePlaceholder')}
            aria-label={t('adminEditor.editor.titleLabel')}
          />
          <input
            className="subtitle-input"
            value={subtitle}
            onChange={(event) => {
              setSubtitle(event.target.value)
              markDirty()
            }}
            placeholder={t('adminEditor.editor.subtitlePlaceholder')}
            aria-label={t('adminEditor.editor.subtitleLabel')}
          />

          {selectedImage ? (
            <div className="admin-card" style={{ marginBottom: '1rem', padding: '0.9rem' }}>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="image-alt">{t('adminEditor.editor.imageAlt')}</label>
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
                  <label htmlFor="image-caption">{t('adminEditor.editor.imageCaption')}</label>
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

          <div className="editor-toolbar" role="toolbar" aria-label={t('adminEditor.toolbar.formatting')}>
            <select
              aria-label={t('adminEditor.toolbar.paragraphStyle')}
              value={headingValue}
              onChange={(event) => {
                const value = event.target.value
                if (!editor) return
                if (value === 'p') editor.chain().focus().setParagraph().run()
                else
                  editor
                    .chain()
                    .focus()
                    .toggleHeading({ level: Number(value) as 1 | 2 | 3 | 4 | 5 | 6 })
                    .run()
              }}
            >
              <option value="p">{t('adminEditor.toolbar.paragraph')}</option>
              <option value="1">{t('adminEditor.toolbar.heading1')}</option>
              <option value="2">{t('adminEditor.toolbar.heading2')}</option>
              <option value="3">{t('adminEditor.toolbar.heading3')}</option>
              <option value="4">{t('adminEditor.toolbar.heading4')}</option>
              <option value="5">{t('adminEditor.toolbar.heading5')}</option>
              <option value="6">{t('adminEditor.toolbar.heading6')}</option>
            </select>
            <span className="divider" />
            <ToolbarButton
              label="B"
              title={t('adminEditor.toolbar.bold')}
              active={editor?.isActive('bold')}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            />
            <ToolbarButton
              label="I"
              title={t('adminEditor.toolbar.italic')}
              active={editor?.isActive('italic')}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            />
            <ToolbarButton
              label="U"
              title={t('adminEditor.toolbar.underline')}
              active={editor?.isActive('underline')}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
            />
            <ToolbarButton
              label="S"
              title={t('adminEditor.toolbar.strikethrough')}
              active={editor?.isActive('strike')}
              onClick={() => editor?.chain().focus().toggleStrike().run()}
            />
            <ToolbarButton
              label="`"
              title={t('adminEditor.toolbar.inlineCode')}
              active={editor?.isActive('code')}
              onClick={() => editor?.chain().focus().toggleCode().run()}
            />
            <span className="divider" />
            <ToolbarButton
              label="•"
              title={t('adminEditor.toolbar.bulletList')}
              active={editor?.isActive('bulletList')}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            />
            <ToolbarButton
              label="1."
              title={t('adminEditor.toolbar.orderedList')}
              active={editor?.isActive('orderedList')}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            />
            <ToolbarButton
              label="❝"
              title={t('adminEditor.toolbar.blockquote')}
              active={editor?.isActive('blockquote')}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            />
            <ToolbarButton
              label="</>"
              title={t('adminEditor.toolbar.codeBlock')}
              active={editor?.isActive('codeBlock')}
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            />
            <span className="divider" />
            <ToolbarButton
              label={t('adminEditor.toolbar.linkLabel')}
              title={t('adminEditor.toolbar.link')}
              active={editor?.isActive('link')}
              onClick={() => setLinkOpen(true)}
            />
            <ToolbarButton
              label={t('adminEditor.toolbar.imageLabel')}
              title={t('adminEditor.toolbar.image')}
              onClick={() => setPicker('inline')}
            />
            <ToolbarButton
              label={t('adminEditor.toolbar.tableLabel')}
              title={t('adminEditor.toolbar.table')}
              onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            />
            <ToolbarButton
              label={t('adminEditor.toolbar.embedLabel')}
              title={t('adminEditor.toolbar.embed')}
              onClick={() => setEmbedOpen(true)}
            />
            <ToolbarButton
              label="—"
              title={t('adminEditor.toolbar.horizontalRule')}
              onClick={() => editor?.chain().focus().setHorizontalRule().run()}
            />
            <span className="divider" />
            <ToolbarButton
              label="↶"
              title={t('adminEditor.toolbar.undo')}
              onClick={() => editor?.chain().focus().undo().run()}
            />
            <ToolbarButton
              label="↷"
              title={t('adminEditor.toolbar.redo')}
              onClick={() => editor?.chain().focus().redo().run()}
            />
          </div>

          <div className="editor-surface">
            <EditorContent editor={editor} />
          </div>
          <div className="editor-meta">
            <span>
              {t('adminEditor.editor.wordCount', { count: words })} ·{' '}
              {t('adminEditor.editor.readTime', { count: minutes })}
            </span>
            <span>
              {t('adminEditor.editor.characterCount', { count: editor?.storage.characterCount.characters() ?? 0 })}
            </span>
          </div>
        </div>

        <aside className="editor-side">
          <section className="editor-side__section">
            <h2>{t('adminEditor.publishing.title')}</h2>
            <div className="field">
              <span className="label">{t('adminEditor.publishing.status')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <StatusBadge status={status} />
                <span className="meta">
                  {publishedAt
                    ? t('adminEditor.publishing.publishedOn', { date: formatDate(publishedAt, 'short') })
                    : scheduledFor
                      ? t('adminEditor.publishing.scheduledOn', { date: formatDate(scheduledFor, 'short') })
                      : t('adminEditor.publishing.notPublic')}
                </span>
              </div>
            </div>
            <div className="field">
              <label htmlFor="schedule">{t('adminEditor.publishing.scheduleLabel')}</label>
              <input
                className="input"
                id="schedule"
                type="datetime-local"
                value={scheduleValue}
                onChange={(event) => setScheduleValue(event.target.value)}
              />
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                <button className="btn btn--ghost btn--small" type="button" onClick={() => void schedule()}>
                  {t('adminEditor.publishing.scheduleButton')}
                </button>
                <button className="btn btn--ghost btn--small" type="button" onClick={() => void archive()}>
                  {t('adminEditor.publishing.archive')}
                </button>
              </div>
            </div>
            {status === 'published' ? (
              <a className="text-link" href={`/articles/${currentSlug}`} target="_blank" rel="noopener">
                {t('adminEditor.publishing.viewLive')}
              </a>
            ) : null}
            {previewUrl ? (
              <a className="text-link" href={previewUrl} target="_blank" rel="noopener">
                {t('adminEditor.publishing.openPreview')}
              </a>
            ) : null}
          </section>

          <section className="editor-side__section">
            <h2>{t('adminEditor.organisation.title')}</h2>
            <div className="field">
              <label htmlFor="category">{t('adminEditor.organisation.section')}</label>
              <select
                className="select"
                id="category"
                value={categoryId ?? ''}
                onChange={(event) => {
                  setCategoryId(event.target.value || null)
                  markDirty()
                }}
              >
                <option value="">{t('adminEditor.organisation.uncategorised')}</option>
                {props.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="author">{t('adminEditor.organisation.author')}</label>
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
                  <option key={author.id} value={author.id}>
                    {author.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="tag-filter">{t('adminEditor.organisation.tags')}</label>
              <input
                className="input"
                id="tag-filter"
                value={tagFilter}
                onChange={(event) => setTagFilter(event.target.value)}
                placeholder={t('adminEditor.organisation.filterTags')}
              />
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.35rem',
                  marginTop: '0.45rem',
                  maxHeight: '9rem',
                  overflowY: 'auto',
                }}
              >
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
                {!filteredTags.length ? (
                  <span className="hint">{t('adminEditor.organisation.noTagsMatch')}</span>
                ) : null}
              </div>
            </div>
          </section>

          <section className="editor-side__section">
            <h2>{t('adminEditor.featuredImage.title')}</h2>
            <div className="media-preview">{featured ? <img src={featured.src} alt={featured.alt} /> : null}</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn--ghost btn--small" type="button" onClick={() => setPicker('featured')}>
                {featured ? t('adminEditor.featuredImage.changeImage') : t('adminEditor.featuredImage.chooseImage')}
              </button>
              {featured ? (
                <button
                  className="btn btn--ghost btn--small"
                  type="button"
                  onClick={() => {
                    setFeaturedMediaId(null)
                    markDirty()
                  }}
                >
                  {t('adminEditor.featuredImage.remove')}
                </button>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="featured-caption">{t('adminEditor.featuredImage.caption')}</label>
              <input
                className="input"
                id="featured-caption"
                value={featuredCaption}
                onChange={(event) => {
                  setFeaturedCaption(event.target.value)
                  markDirty()
                }}
                placeholder={t('adminEditor.featuredImage.captionPlaceholder')}
              />
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(event) => {
                  setIsFeatured(event.target.checked)
                  markDirty()
                }}
              />
              <span>
                {t('adminEditor.featuredImage.featureHomepage')}
                <small>{t('adminEditor.featuredImage.featureHomepageHint')}</small>
              </span>
            </label>
            <div className="field">
              <label htmlFor="featured-rank">{t('adminEditor.featuredImage.rank')}</label>
              <input
                className="input"
                id="featured-rank"
                type="number"
                min={0}
                max={99}
                value={featuredRank ?? ''}
                onChange={(event) => {
                  setFeaturedRank(event.target.value ? Number(event.target.value) : null)
                  markDirty()
                }}
              />
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={isEditorsPick}
                onChange={(event) => {
                  setIsEditorsPick(event.target.checked)
                  markDirty()
                }}
              />
              <span>{t('adminEditor.featuredImage.editorsPick')}</span>
            </label>
          </section>

          <section className="editor-side__section">
            <h2>{t('adminEditor.excerpt.title')}</h2>
            <textarea
              className="textarea"
              value={excerpt}
              onChange={(event) => {
                setExcerpt(event.target.value)
                markDirty()
              }}
              placeholder={t('adminEditor.excerpt.placeholder')}
              rows={4}
              maxLength={600}
            />
          </section>

          <section className="editor-side__section">
            <h2>{t('adminEditor.seo.title')}</h2>
            <div className="field">
              <label htmlFor="slug">{t('adminEditor.seo.slug')}</label>
              <input
                className="input"
                id="slug"
                value={slug}
                onChange={(event) => {
                  setSlug(slugify(event.target.value))
                  setSlugTouched(true)
                  markDirty()
                }}
              />
              <p className="hint">/articles/{currentSlug}</p>
            </div>
            <div className="field">
              <label htmlFor="seo-title">{t('adminEditor.seo.seoTitle')}</label>
              <input
                className="input"
                id="seo-title"
                value={seoTitle}
                onChange={(event) => {
                  setSeoTitle(event.target.value)
                  markDirty()
                }}
                placeholder={title || t('adminEditor.seo.seoTitlePlaceholder')}
                maxLength={200}
              />
            </div>
            <div className="field">
              <label htmlFor="seo-description">{t('adminEditor.seo.metaDescription')}</label>
              <textarea
                className="textarea"
                id="seo-description"
                value={seoDescription}
                onChange={(event) => {
                  setSeoDescription(event.target.value)
                  markDirty()
                }}
                placeholder={excerpt || t('adminEditor.seo.metaDescriptionPlaceholder')}
                rows={3}
                maxLength={400}
              />
              <p className="hint">{seoDescription.length}/400</p>
            </div>
            <div className="field">
              <label htmlFor="canonical">{t('adminEditor.seo.canonical')}</label>
              <input
                className="input"
                id="canonical"
                value={canonicalUrl}
                onChange={(event) => {
                  setCanonicalUrl(event.target.value)
                  markDirty()
                }}
                placeholder="https://"
              />
            </div>
            <div className="field">
              <span className="label">{t('adminEditor.seo.socialImage')}</span>
              <div className="media-preview" style={{ aspectRatio: '1200 / 630' }}>
                {og ? (
                  <img src={og.src} alt={og.alt} />
                ) : featured ? (
                  <img src={featured.src} alt={featured.alt} />
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn--ghost btn--small" type="button" onClick={() => setPicker('og')}>
                  {og ? t('adminEditor.featuredImage.changeImage') : t('adminEditor.featuredImage.chooseImage')}
                </button>
                {og ? (
                  <button
                    className="btn btn--ghost btn--small"
                    type="button"
                    onClick={() => {
                      setOgMediaId(null)
                      markDirty()
                    }}
                  >
                    {t('adminEditor.seo.useFeatured')}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="field">
              <label htmlFor="article-language">{t('adminEditor.seo.language')}</label>
              <select
                className="select"
                id="article-language"
                value={language}
                onChange={(event) => {
                  setLanguage(event.target.value)
                  markDirty()
                }}
              >
                <option value="">{t('adminEditor.seo.languageAuto')}</option>
                <option value="id">{t('adminEditor.seo.languageId')}</option>
                <option value="en">{t('adminEditor.seo.languageEn')}</option>
              </select>
              <p className="hint">{t('adminEditor.seo.languageHint')}</p>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={noIndex}
                onChange={(event) => {
                  setNoIndex(event.target.checked)
                  markDirty()
                }}
              />
              <span>
                {t('adminEditor.seo.noIndex')}
                <small>{t('adminEditor.seo.noIndexHint')}</small>
              </span>
            </label>

            <div className="seo-preview">
              <div className="seo-preview__url">
                {props.siteOrigin.replace(/^https?:\/\//, '')}/articles/{currentSlug}
              </div>
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
              <h2>{t('adminEditor.danger.title')}</h2>
              {!deleteArmed ? (
                <button className="btn btn--danger btn--small" type="button" onClick={() => setDeleteArmed(true)}>
                  {t('adminEditor.danger.deleteArticle')}
                </button>
              ) : (
                <div>
                  <p className="hint" style={{ marginBottom: '0.5rem' }}>
                    {t('adminEditor.danger.warning')}
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn--danger btn--small" type="button" onClick={() => void removeArticle()}>
                      {t('adminEditor.danger.confirm')}
                    </button>
                    <button className="btn btn--ghost btn--small" type="button" onClick={() => setDeleteArmed(false)}>
                      {t('adminEditor.danger.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </section>
          ) : null}
        </aside>
      </div>

      <MediaPicker
        open={picker !== null}
        title={
          picker === 'og'
            ? t('adminEditor.mediaPicker.titleSocial')
            : picker === 'inline'
              ? t('adminEditor.mediaPicker.titleInline')
              : t('adminEditor.mediaPicker.titleFeatured')
        }
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
            const safe =
              href.startsWith('/') || /^https?:\/\//i.test(href) || href.startsWith('mailto:')
                ? href
                : `https://${href}`
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
            show(t('adminEditor.embedDialog.invalid'), 'error')
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
  const { t } = useI18n()
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
      setError(t('adminEditor.mediaLibrary.chooseImageError'))
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
        setError(result.error ?? t('adminEditor.mediaLibrary.uploadFailed'))
        continue
      }
      setMedia((current) => [result.data!.media, ...current])
      show(t('adminEditor.mediaLibrary.uploaded', { name: file.name }))
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
      show(result.error ?? t('adminEditor.mediaLibrary.saveFailed'), 'error')
      return
    }
    setMedia((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, alt: patch.alt, caption: patch.caption } : entry)),
    )
    show(t('adminEditor.mediaLibrary.saved'))
  }

  async function remove(item: AdminMediaSummary) {
    const result = await api(`/api/admin/media/${item.id}`, { method: 'DELETE', csrfToken: props.csrfToken })
    if (!result.ok) {
      show(result.error ?? t('adminEditor.mediaLibrary.deleteFailed'), 'error')
      return
    }
    setMedia((current) => current.filter((entry) => entry.id !== item.id))
    show(t('adminEditor.mediaLibrary.deleted'))
  }

  return (
    <div>
      <div className="filter-bar">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="media-q">{t('adminEditor.mediaLibrary.searchLabel')}</label>
          <input
            className="input"
            id="media-q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('adminEditor.mediaLibrary.searchPlaceholder')}
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
        <button
          className="btn btn--solid btn--small"
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? t('adminEditor.mediaLibrary.uploading') : t('adminEditor.mediaLibrary.upload')}
        </button>
      </div>

      {error ? (
        <div className="flash" data-tone="error">
          {error}
        </div>
      ) : null}

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
        <p>{t('adminEditor.mediaLibrary.dropHere')}</p>
        <p className="hint">{t('adminEditor.mediaLibrary.formatsHint')}</p>
      </div>

      {filtered.length ? (
        <div className="media-grid">
          {filtered.map((item) => {
            const canEdit = item.canEdit !== false
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
                    aria-label={t('adminEditor.mediaLibrary.altAria', { name: item.originalName ?? item.id })}
                    value={draft.alt}
                    placeholder={t('adminEditor.mediaLibrary.altLabel')}
                    disabled={!canEdit}
                    onChange={(event) => {
                      if (!canEdit) return
                      setEditing((current) => ({ ...current, [item.id]: { ...draft, alt: event.target.value } }))
                    }}
                    onBlur={() => {
                      if (canEdit) void saveMetadata(item)
                    }}
                    style={{ padding: '0.4rem 0.5rem', fontSize: '0.82rem' }}
                  />
                  <input
                    className="input"
                    aria-label={t('adminEditor.mediaLibrary.captionAria', { name: item.originalName ?? item.id })}
                    value={draft.caption}
                    placeholder={t('adminEditor.mediaLibrary.captionPlaceholder')}
                    disabled={!canEdit}
                    onChange={(event) => {
                      if (!canEdit) return
                      setEditing((current) => ({ ...current, [item.id]: { ...draft, caption: event.target.value } }))
                    }}
                    onBlur={() => {
                      if (canEdit) void saveMetadata(item)
                    }}
                    style={{ padding: '0.4rem 0.5rem', fontSize: '0.82rem' }}
                  />
                  <div className="media-item__actions">
                    <button
                      className="btn btn--ghost btn--small"
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(item.src)
                          show(t('adminEditor.mediaLibrary.copied'))
                        } catch {
                          show(t('adminEditor.mediaLibrary.copyFailed'), 'error')
                        }
                      }}
                    >
                      {t('adminEditor.mediaLibrary.copyUrl')}
                    </button>
                    {canEdit ? (
                      <button className="btn btn--danger btn--small" type="button" onClick={() => void remove(item)}>
                        {t('adminEditor.mediaLibrary.delete')}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="empty-state">
          <h2>{t('adminEditor.mediaLibrary.emptyTitle')}</h2>
          <p>{t('adminEditor.mediaLibrary.emptyBody')}</p>
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
    rootElement.textContent = translate('adminEditor.errors.loadFailed')
    return
  }
  const root = createRoot(rootElement)
  if (mode === 'editor') {
    root.render(
      <I18nProvider locale={documentLocale()}>
        <ArticleEditor props={props as EditorProps} />
      </I18nProvider>,
    )
  } else if (mode === 'media') {
    root.render(
      <I18nProvider locale={documentLocale()}>
        <MediaLibrary props={props as MediaPageProps} />
      </I18nProvider>,
    )
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}

export {}
