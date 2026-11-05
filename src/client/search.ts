type Part = { text: string; match: boolean }

type SearchResult = {
  slug: string
  title: string
  category: string
  accent: string
  publishedAt: string | null
  readingMinutes: number
  titleParts: Part[]
  snippetParts: Part[]
}

function partsNode(parts: Part[], parent: HTMLElement): void {
  for (const part of parts) {
    if (part.match) {
      const mark = document.createElement('mark')
      mark.textContent = part.text
      parent.append(mark)
    } else {
      parent.append(document.createTextNode(part.text))
    }
  }
}

function resultNode(result: SearchResult): HTMLAnchorElement {
  const link = document.createElement('a')
  link.className = 'search-result'
  link.href = `/articles/${result.slug}`

  const top = document.createElement('div')
  top.className = 'search-result__top'
  const category = document.createElement('span')
  category.className = 'meta'
  category.textContent = result.category
  const date = document.createElement('span')
  date.className = 'meta'
  date.textContent = result.publishedAt
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(result.publishedAt))
    : ''
  const reading = document.createElement('span')
  reading.className = 'meta'
  reading.textContent = `${result.readingMinutes} min read`
  top.append(category, date, reading)

  const title = document.createElement('h2')
  title.className = 'search-result__title'
  partsNode(result.titleParts, title)

  const excerpt = document.createElement('p')
  excerpt.className = 'search-result__excerpt'
  partsNode(result.snippetParts, excerpt)

  link.append(top, title, excerpt)
  return link
}

function setupSearch(): void {
  const form = document.querySelector<HTMLFormElement>('[data-search-form]')
  const input = document.querySelector<HTMLInputElement>('[data-search-input]')
  const status = document.querySelector<HTMLElement>('[data-search-status]')
  const loading = document.querySelector<HTMLElement>('[data-search-loading]')
  const serverResults = document.querySelector<HTMLElement>('[data-server-results]')
  const liveResults = document.querySelector<HTMLElement>('[data-live-results]')
  const liveEmpty = document.querySelector<HTMLElement>('[data-live-empty]')
  if (!form || !input || !status || !loading || !liveResults) return

  const initialStatus = status.textContent ?? ''
  const initialQuery = input.value.trim()
  let timer: number | undefined
  let controller: AbortController | undefined

  const reset = () => {
    window.clearTimeout(timer)
    controller?.abort()
    loading.hidden = true
    liveResults.hidden = true
    liveResults.replaceChildren()
    if (liveEmpty) liveEmpty.hidden = true
    if (serverResults) serverResults.hidden = false
    status.textContent = initialStatus
  }

  const run = async (query: string) => {
    controller?.abort()
    controller = new AbortController()
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      reset()
      return
    }
    loading.hidden = false
    status.textContent = `Searching for “${trimmed}”`
    liveResults.hidden = false
    if (serverResults) serverResults.hidden = true
    if (liveEmpty) liveEmpty.hidden = true
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) throw new Error('Search request failed')
      const payload = (await response.json()) as { results: SearchResult[] }
      liveResults.replaceChildren()
      if (!payload.results.length) {
        liveResults.hidden = true
        if (liveEmpty) liveEmpty.hidden = false
        status.textContent = `No results for “${trimmed}”`
      } else {
        for (const result of payload.results) liveResults.append(resultNode(result))
        status.textContent = `${payload.results.length} ${payload.results.length === 1 ? 'result' : 'results'} for “${trimmed}”`
      }
      const url = new URL(window.location.href)
      url.searchParams.set('q', trimmed)
      window.history.replaceState({}, '', url)
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      status.textContent = 'Search is unavailable right now. Submit the form to try again.'
    } finally {
      loading.hidden = true
    }
  }

  input.addEventListener('input', () => {
    window.clearTimeout(timer)
    const query = input.value
    if (query.trim().length < 2) {
      reset()
      return
    }
    timer = window.setTimeout(() => void run(query), 260)
  })

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      input.value = ''
      reset()
    }
  })

  if (initialQuery.trim().length >= 2) {
    status.textContent = initialStatus
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupSearch, { once: true })
} else {
  setupSearch()
}
