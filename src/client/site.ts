import '../styles/base.css'
import '../styles/site.css'

const SAVED_KEY = 'commonplace:saved'

function readSaved(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return []
  }
}

function writeSaved(slugs: string[]): void {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...new Set(slugs)]))
  } catch {
    // Storage may be unavailable (private mode); the UI still reflects in-memory state.
  }
}

function updateSavedIndicators(): void {
  const saved = readSaved()
  document.querySelectorAll<HTMLElement>('[data-saved-count]').forEach((node) => {
    node.textContent = saved.length ? String(saved.length) : ''
  })
  document.querySelectorAll<HTMLButtonElement>('[data-bookmark]').forEach((button) => {
    const slug = button.dataset.bookmark
    if (!slug) return
    const isSaved = saved.includes(slug)
    button.dataset.active = isSaved ? 'true' : 'false'
    button.setAttribute('aria-pressed', isSaved ? 'true' : 'false')
    const label = button.querySelector<HTMLElement>('[data-bookmark-label]')
    if (label) label.textContent = isSaved ? 'Saved for later' : 'Save for later'
  })
}

function toggleBookmark(slug: string): void {
  const saved = readSaved()
  const next = saved.includes(slug) ? saved.filter((value) => value !== slug) : [slug, ...saved]
  writeSaved(next)
  updateSavedIndicators()
}

function setupTheme(): void {
  const apply = (theme: 'light' | 'dark') => {
    document.documentElement.dataset.theme = theme
    document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((button) => {
      button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme')
      button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false')
    })
  }
  apply((document.documentElement.dataset.theme as 'light' | 'dark') || 'light')
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
      apply(next)
      try {
        localStorage.setItem('theme', next)
      } catch {
        // ignore
      }
    })
  })
}

function setupMobileMenu(): void {
  const menu = document.getElementById('mobile-menu')
  const openButton = document.querySelector<HTMLButtonElement>('[data-menu-open]')
  const closeButton = document.querySelector<HTMLButtonElement>('[data-menu-close]')
  if (!menu || !openButton) return

  const close = () => {
    menu.setAttribute('hidden', '')
    menu.removeAttribute('open')
    openButton.setAttribute('aria-expanded', 'false')
    document.body.style.overflow = ''
    openButton.focus()
  }
  const open = () => {
    menu.removeAttribute('hidden')
    menu.setAttribute('open', '')
    openButton.setAttribute('aria-expanded', 'true')
    document.body.style.overflow = 'hidden'
    menu.focus()
  }

  openButton.addEventListener('click', open)
  closeButton?.addEventListener('click', close)
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', close))
  document.addEventListener('keydown', (event) => {
    if (menu.hasAttribute('hidden')) return
    if (event.key === 'Escape') {
      close()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(
      menu.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return
    if (event.shiftKey && (document.activeElement === first || document.activeElement === menu)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  })
}

function setupProgress(): void {
  const bar = document.querySelector<HTMLElement>('[data-progress]')
  if (!bar) return
  let ticking = false
  const update = () => {
    ticking = false
    const article = document.querySelector<HTMLElement>('.article-body')
    const start = article ? article.offsetTop : 0
    const height = article ? article.offsetHeight : document.documentElement.scrollHeight
    const viewport = window.innerHeight
    const max = Math.max(1, start + height - viewport * 0.55)
    const progress = Math.min(1, Math.max(0, (window.scrollY - start + viewport * 0.35) / max))
    bar.style.width = `${(progress * 100).toFixed(2)}%`
  }
  const onScroll = () => {
    if (!ticking) {
      ticking = true
      requestAnimationFrame(update)
    }
  }
  update()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
}

function setupTocSpy(): void {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.toc a[href^="#"]'))
  if (!links.length || !('IntersectionObserver' in window)) return
  const map = new Map<string, HTMLAnchorElement>()
  const targets: HTMLElement[] = []
  for (const link of links) {
    const id = decodeURIComponent(link.getAttribute('href')?.slice(1) ?? '')
    const target = id ? document.getElementById(id) : null
    if (target) {
      map.set(id, link)
      targets.push(target)
    }
  }
  if (!targets.length) return

  let active = ''
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      const candidate = visible[0]?.target.id
      if (candidate && candidate !== active) {
        active = candidate
        map.forEach((link, id) => {
          if (id === candidate) link.setAttribute('aria-current', 'true')
          else link.removeAttribute('aria-current')
        })
      }
    },
    { rootMargin: '-10% 0px -70% 0px', threshold: [0, 1] },
  )
  targets.forEach((target) => observer.observe(target))
}

function setupBookmarks(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-bookmark]').forEach((button) => {
    button.addEventListener('click', () => {
      const slug = button.dataset.bookmark
      if (slug) toggleBookmark(slug)
    })
  })
  updateSavedIndicators()
}

function setupShare(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-share]').forEach((button) => {
    button.addEventListener('click', async () => {
      const url = button.dataset.shareUrl || window.location.href
      const title = button.dataset.shareTitle || document.title
      const label = button.querySelector('span')
      const original = label?.textContent ?? ''
      try {
        if (navigator.share) {
          await navigator.share({ title, url })
          return
        }
        await navigator.clipboard.writeText(url)
        if (label) label.textContent = 'Link copied'
        window.setTimeout(() => {
          if (label) label.textContent = original
        }, 1800)
      } catch {
        if (label) label.textContent = 'Copy the address bar'
        window.setTimeout(() => {
          if (label) label.textContent = original
        }, 2200)
      }
    })
  })
}

function setupNewsletter(): void {
  document.querySelectorAll<HTMLFormElement>('[data-newsletter]').forEach((form) => {
    const message = form.querySelector<HTMLElement>('[data-message]')
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      if (!message) return
      const data = new FormData(form)
      const email = String(data.get('email') ?? '').trim()
      message.dataset.state = ''
      message.textContent = ''
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        message.dataset.state = 'error'
        message.textContent = 'Please enter a valid email address.'
        form.querySelector<HTMLInputElement>('input[name="email"]')?.focus()
        return
      }
      const original = submit?.textContent ?? ''
      if (submit) {
        submit.disabled = true
        submit.textContent = 'Subscribing…'
      }
      try {
        const response = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            email,
            website: String(data.get('website') ?? ''),
            source: String(data.get('source') ?? 'site'),
          }),
        })
        const payload = (await response.json()) as { status?: string }
        if (response.ok && payload.status === 'pending') {
          message.dataset.state = 'success'
          message.textContent = 'Check your inbox and click the confirmation link to join the list.'
          form.reset()
        } else if (response.ok && payload.status === 'ok') {
          message.dataset.state = 'success'
          message.textContent = 'You are on the list. Thank you for subscribing.'
          form.reset()
        } else if (response.ok && payload.status === 'exists') {
          message.dataset.state = 'success'
          message.textContent = 'That address is already subscribed.'
        } else if (response.status === 429) {
          message.dataset.state = 'error'
          message.textContent = 'Too many attempts. Please try again later.'
        } else {
          message.dataset.state = 'error'
          message.textContent = 'Please check the address and try again.'
        }
      } catch {
        message.dataset.state = 'error'
        message.textContent = 'The connection failed. Please try again.'
      } finally {
        if (submit) {
          submit.disabled = false
          submit.textContent = original
        }
      }
    })
  })
}

type SavedArticle = {
  slug: string
  title: string
  excerpt: string
  category: string
  accent: string
  publishedAt: string | null
  readingMinutes: number
  cover: { src: string; alt: string } | null
}

function renderSavedArticle(article: SavedArticle, onRemove: () => void): HTMLElement {
  const row = document.createElement('div')
  row.className = `article-row accent-${article.accent}`

  const meta = document.createElement('div')
  meta.className = 'article-row__meta'
  const category = document.createElement('span')
  category.className = 'cat'
  category.textContent = article.category
  const date = document.createElement('span')
  date.className = 'meta'
  date.textContent = article.publishedAt
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(article.publishedAt))
    : ''
  meta.append(category, date)

  const body = document.createElement('div')
  body.className = 'article-row__body'
  const titleLink = document.createElement('a')
  titleLink.className = 'article-row__title'
  titleLink.href = `/articles/${article.slug}`
  titleLink.textContent = article.title
  const excerpt = document.createElement('p')
  excerpt.className = 'article-row__excerpt'
  excerpt.textContent = article.excerpt
  body.append(titleLink, excerpt)

  const actions = document.createElement('div')
  actions.style.display = 'flex'
  actions.style.alignItems = 'center'
  actions.style.gap = '0.5rem'
  const read = document.createElement('a')
  read.className = 'text-link'
  read.href = `/articles/${article.slug}`
  read.textContent = 'Read →'
  const remove = document.createElement('button')
  remove.type = 'button'
  remove.className = 'btn btn--ghost btn--small'
  remove.textContent = 'Remove'
  remove.addEventListener('click', () => {
    toggleBookmark(article.slug)
    onRemove()
  })
  actions.append(read, remove)

  row.append(meta, body, actions)
  return row
}

async function setupSavedPage(): Promise<void> {
  const root = document.querySelector<HTMLElement>('[data-saved-root]')
  if (!root) return
  const list = root.querySelector<HTMLElement>('[data-saved-list]')
  const empty = root.querySelector<HTMLElement>('[data-saved-empty]')
  const meta = document.querySelector<HTMLElement>('[data-saved-meta]')
  if (!list || !empty) return

  const render = async () => {
    const saved = readSaved()
    updateSavedIndicators()
    if (meta) meta.textContent = saved.length ? `${saved.length} saved ${saved.length === 1 ? 'article' : 'articles'}` : 'No saved articles'
    list.replaceChildren()
    if (!saved.length) {
      empty.hidden = false
      return
    }
    empty.hidden = true
    const loading = document.createElement('p')
    loading.className = 'meta'
    loading.textContent = 'Loading your reading list…'
    list.append(loading)
    try {
      const response = await fetch(`/api/articles?slugs=${encodeURIComponent(saved.join(','))}`)
      if (!response.ok) throw new Error('Request failed')
      const payload = (await response.json()) as { articles: SavedArticle[] }
      list.replaceChildren()
      if (!payload.articles.length) {
        empty.hidden = false
        return
      }
      for (const article of payload.articles) {
        list.append(renderSavedArticle(article, render))
      }
    } catch {
      loading.textContent = 'Your saved articles could not be loaded. Please refresh the page.'
    }
  }

  await render()
}

function init(): void {
  setupTheme()
  setupMobileMenu()
  setupProgress()
  setupTocSpy()
  setupBookmarks()
  setupShare()
  setupNewsletter()
  void setupSavedPage()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}
