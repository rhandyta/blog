import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import zlib from 'node:zlib'
import { chromium } from 'playwright'

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const lengthBytes = Buffer.alloc(4)
  lengthBytes.writeUInt32BE(data.length, 0)
  const crcInput = Buffer.concat([typeBytes, data])
  const crcBytes = Buffer.alloc(4)
  crcBytes.writeUInt32BE(zlib.crc32(crcInput) >>> 0, 0)
  return Buffer.concat([lengthBytes, typeBytes, data, crcBytes])
}

function createSamplePng(width = 16, height = 16) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // RGB color type
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const rowSize = 1 + width * 3
  const raw = Buffer.alloc(height * rowSize)
  for (let y = 0; y < height; y++) {
    const offset = y * rowSize
    raw[offset] = 0 // filter none
    for (let x = 0; x < width; x++) {
      const px = offset + 1 + x * 3
      raw[px] = 200
      raw[px + 1] = 69
      raw[px + 2] = 43
    }
  }
  const compressed = zlib.deflateSync(raw)
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

async function launchBrowser() {
  const options = { headless: true }
  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) {
    return chromium.launch({ ...options, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH })
  }
  try {
    return await chromium.launch(options)
  } catch (error) {
    for (const channel of ['chrome', 'msedge']) {
      try {
        return await chromium.launch({ ...options, channel })
      } catch {
        // try next locally installed browser channel
      }
    }
    throw error
  }
}

async function startServer() {
  const bunBin = process.env.BUN_BIN || 'bun'
  const child = spawn(bunBin, ['scripts/e2e-server.ts'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGTERM')
      reject(new Error(`E2E server timed out.\nstdout:\n${stdout}\nstderr:\n${stderr}`))
    }, 20_000)

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8')
      const match = /E2E_SERVER_READY (\{[^\r\n]+\})/.exec(stdout)
      if (match && !settled) {
        settled = true
        clearTimeout(timer)
        resolve({ child, info: JSON.parse(match[1]) })
      }
    })

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString('utf8')
      stderr += text
      if (settled) process.stderr.write(text)
    })

    child.on('exit', (code) => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        reject(new Error(`E2E server exited prematurely (${code}).\nstdout:\n${stdout}\nstderr:\n${stderr}`))
      }
    })
  })
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return
  await new Promise((resolve) => {
    const forceTimer = setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {
        // ignore
      }
      resolve()
    }, 5_000)
    child.once('exit', () => {
      clearTimeout(forceTimer)
      resolve()
    })
    child.kill('SIGTERM')
  })
}

function logStep(label) {
  console.log(`  ✓ ${label}`)
}

async function main() {
  console.log('Starting isolated production E2E server…')
  const { child, info } = await startServer()
  const { origin } = info
  const downloadDir = await mkdtemp(join(tmpdir(), 'rhandytaverse-e2e-dl-'))
  const sampleImagePath = join(downloadDir, 'e2e-sample.png')
  await mkdir(downloadDir, { recursive: true })
  await writeFile(sampleImagePath, createSamplePng(24, 24))

  let browser
  try {
    browser = await launchBrowser()
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      acceptDownloads: true,
    })

    // Keep offline CI runs deterministic while proving the strict CSP allows GTM script execution.
    await context.route('https://www.googletagmanager.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'window.__gtmStubLoaded = true;',
      })
    })
    await context.route('https://www.google-analytics.com/**', async (route) => {
      await route.fulfill({ status: 204, body: '' })
    })

    const page = await context.newPage()
    const pageErrors = []
    const serverErrors = []
    await page.addInitScript(() => {
      window.__cspViolations = []
      document.addEventListener('securitypolicyviolation', (event) => {
        window.__cspViolations.push({
          directive: event.violatedDirective,
          blockedURI: event.blockedURI,
        })
      })
    })
    page.on('pageerror', (err) => {
      pageErrors.push(err.message)
      console.error('  [pageerror]', err.message)
    })
    page.on('response', (res) => {
      if (res.status() >= 500) {
        serverErrors.push(`${res.status()} ${res.url()}`)
        console.error('  [http 5xx]', res.status(), res.url())
      }
    })

    // 1. Public homepage + strict CSP + external analytics.js initialization
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' })
    const homeTitle = await page.title()
    assert.ok(homeTitle.includes('RhandytaVERSE'), `Unexpected title: ${homeTitle}`)
    await page.locator('text=The Published Test Article').first().waitFor({ state: 'visible' })
    const runtimeState = await page.evaluate(() => ({
      hasGtag: typeof window.gtag === 'function',
      dataLayerCount: Array.isArray(window.dataLayer) ? window.dataLayer.length : 0,
      stylesheets: document.styleSheets.length,
      cspViolations: window.__cspViolations,
    }))
    assert.equal(runtimeState.hasGtag, true)
    assert.ok(runtimeState.dataLayerCount >= 1)
    assert.ok(runtimeState.stylesheets >= 1)
    assert.deepEqual(runtimeState.cspViolations, [])
    logStep('Homepage renders under production CSP with external analytics.js & styles')

    // 2. Theme toggle persistence across reloads
    const initialTheme = await page.evaluate(() => document.documentElement.dataset.theme || 'light')
    const expectedTheme = initialTheme === 'dark' ? 'light' : 'dark'
    await page.locator('[data-theme-toggle]').first().click()
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), expectedTheme)
    await page.reload({ waitUntil: 'networkidle' })
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), expectedTheme)
    logStep('Theme toggle persists cleanly across page reloads')

    // 3. Mobile navigation drawer
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('[data-menu-open]').click()
    await page.locator('#mobile-menu[open]').waitFor({ state: 'visible' })
    await page.keyboard.press('Escape')
    await page.locator('#mobile-menu').waitFor({ state: 'hidden' })
    await page.setViewportSize({ width: 1280, height: 800 })
    logStep('Mobile navigation drawer opens and closes via Escape')

    // 4. Live client search on /search
    await page.goto(`${origin}/search`, { waitUntil: 'networkidle' })
    await page.locator('[data-search-input]').fill('notebook')
    const liveHit = page.locator('[data-live-results] a[href="/articles/test-published"]')
    await liveHit.waitFor({ state: 'visible' })
    const searchStatusText = await page.locator('[data-search-status]').textContent()
    assert.ok(searchStatusText?.includes('hasil'), `Unexpected search status: ${searchStatusText}`)
    logStep('Live client search queries /api/search and renders highlighted hits')

    // 5. Bookmarks & /saved list
    await page.goto(`${origin}/articles/test-published`, { waitUntil: 'networkidle' })
    const bookmarkBtn = page.locator('[data-bookmark="test-published"]').first()
    await bookmarkBtn.click()
    assert.equal(await bookmarkBtn.getAttribute('aria-pressed'), 'true')
    assert.equal(await page.locator('[data-saved-count]').first().textContent(), '1')

    await page.goto(`${origin}/saved`, { waitUntil: 'networkidle' })
    await page.locator('[data-saved-list] a.article-row__title[href="/articles/test-published"]').waitFor({ state: 'visible' })
    await page.locator('[data-saved-list] button:has-text("Hapus")').first().click()
    await page.locator('[data-saved-empty]').waitFor({ state: 'visible' })
    logStep('Bookmarks persist to /saved and remove cleanly')

    // 6. Newsletter validation & progressive subscribe flow
    await page.goto(`${origin}/subscribe`, { waitUntil: 'networkidle' })
    const newsletterForm = page.locator('form[data-newsletter]').first()
    await newsletterForm.locator('input[name="email"]').fill('invalid@no-tld')
    await newsletterForm.locator('button[type="submit"]').click()
    await newsletterForm.locator('[data-message][data-state="error"]').waitFor({ state: 'visible' })

    await newsletterForm.locator('input[name="email"]').fill('e2e-reader@example.com')
    await newsletterForm.locator('button[type="submit"]').click()
    await newsletterForm.locator('[data-message][data-state="success"]').waitFor({ state: 'visible' })
    logStep('Newsletter client validation and /api/subscribe submission succeed')

    // 7. Admin route isolation & login
    await page.goto(`${origin}/admin`, { waitUntil: 'networkidle' })
    assert.ok(page.url().includes('/admin/login'))
    const adminLoginHasAnalytics = await page.evaluate(() => Boolean(document.querySelector('script[src="/analytics.js"]')))
    assert.equal(adminLoginHasAnalytics, false)

    await page.locator('input[name="email"]').fill('test@example.com')
    await page.locator('input[name="password"]').fill('test-password-123')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(`${origin}/admin`)
    await page.locator('h1:has-text("Overview")').waitFor({ state: 'visible' })
    logStep('Admin login establishes production session cookie and enforces no-analytics isolation')

    // 8. TipTap rich-text editor create & save draft
    await page.goto(`${origin}/admin/articles/new`, { waitUntil: 'networkidle' })
    const proseMirror = page.locator('#admin-root[data-mode="editor"] .ProseMirror')
    await proseMirror.waitFor({ state: 'visible' })
    await page.locator('input[aria-label="Article title"]').fill('E2E Browser Test Essay')
    await proseMirror.click()
    await page.keyboard.type('Written and saved inside headless Chromium during E2E verification.')
    const saveResponsePromise = page.waitForResponse(
      (res) => res.url().endsWith('/api/admin/articles') && res.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    const saveResponse = await saveResponsePromise
    assert.equal(saveResponse.status(), 201)
    await page.locator('.editor-save-state[data-tone="saved"]').waitFor({ state: 'visible' })
    await page.goto(`${origin}/admin/articles`, { waitUntil: 'networkidle' })
    await page.locator('text=E2E Browser Test Essay').first().waitFor({ state: 'visible' })
    logStep('TipTap editor mounts, edits, and saves a new draft via /api/admin/articles')

    // 9. Media library upload & image optimization
    await page.goto(`${origin}/admin/media`, { waitUntil: 'networkidle' })
    await page.locator('#admin-root[data-mode="media"] button:has-text("Upload images")').waitFor({ state: 'visible' })
    const uploadResponsePromise = page.waitForResponse(
      (res) => res.url().endsWith('/api/admin/media') && res.request().method() === 'POST',
    )
    await page.locator('input[type="file"]').setInputFiles(sampleImagePath)
    const uploadResponse = await uploadResponsePromise
    assert.equal(uploadResponse.status(), 201)
    const uploadedImg = page.locator('.media-item:has-text("e2e-sample.png") img').first()
    await uploadedImg.waitFor({ state: 'visible' })
    await uploadedImg.scrollIntoViewIfNeeded()
    await page.waitForFunction(() => {
      const img = document.querySelector('.media-item img')
      return Boolean(img?.complete && img.naturalWidth > 0)
    })
    const naturalWidth = await uploadedImg.evaluate((img) => img.naturalWidth)
    assert.ok(naturalWidth > 0, 'Uploaded optimized image failed to load')
    logStep('Media library uploads a PNG, optimizes variants, and renders the asset')

    // 10. System page, JSON backup & Markdown ZIP archive download
    await page.goto(`${origin}/admin/system`, { waitUntil: 'networkidle' })
    await page.locator('h1:has-text("System & backups")').waitFor({ state: 'visible' })
    await page.locator('text=Database (sqlite)').waitFor({ state: 'visible' })

    const [jsonDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('section a[href="/admin/system/backup.json"]').click(),
    ])
    const jsonPath = join(downloadDir, jsonDownload.suggestedFilename())
    await jsonDownload.saveAs(jsonPath)
    const jsonRaw = await readFile(jsonPath, 'utf8')
    assert.equal(jsonRaw.includes('passwordHash'), false)
    assert.equal(jsonRaw.includes('pbkdf2$'), false)
    const jsonParsed = JSON.parse(jsonRaw)
    assert.equal(jsonParsed.formatVersion, 1)
    assert.ok(jsonParsed.articles.some((item) => item.title === 'E2E Browser Test Essay'))
    assert.ok(jsonParsed.articles.some((item) => item.slug === 'test-published'))

    let zipBytes
    const zipResponsePromise = page.waitForResponse((res) => res.url().endsWith('/admin/system/articles.zip'))
    const zipDownloadPromise = page.waitForEvent('download', { timeout: 5_000 }).catch(() => null)
    const [zipResponse, zipDownload] = await Promise.all([
      zipResponsePromise,
      zipDownloadPromise,
      page.locator('a[href="/admin/system/articles.zip"]').click(),
    ])
    if (zipDownload) {
      const zipPath = join(downloadDir, zipDownload.suggestedFilename())
      await zipDownload.saveAs(zipPath)
      zipBytes = await readFile(zipPath)
    } else if (zipResponse.status() === 204 && /IDM/i.test(zipResponse.statusText())) {
      // On Windows hosts with Internet Download Manager hooked into Chrome/Edge,
      // .zip navigations receive a synthetic 204 from IDM's LSP driver; verify via
      // the authenticated browser context request API using the live session cookie.
      const res = await context.request.get(`${origin}/admin/system/articles.zip`)
      assert.equal(res.status(), 200)
      assert.ok((res.headers()['content-type'] ?? '').includes('application/zip'))
      assert.ok((res.headers()['content-disposition'] ?? '').includes('attachment; filename='))
      zipBytes = Buffer.from(await res.body())
    } else {
      throw new Error(`Expected ZIP download, got HTTP ${zipResponse.status()} ${zipResponse.statusText()}`)
    }
    assert.equal(zipBytes.readUInt32LE(0), 0x04034b50)
    assert.ok(zipBytes.includes('README.md'))
    assert.ok(zipBytes.includes('settings.json'))
    assert.ok(zipBytes.includes('articles/test-published.md'))

    const mdRes = await context.request.get(`${origin}/admin/articles/art_test_published/export.md`)
    assert.equal(mdRes.status(), 200)
    assert.ok((mdRes.headers()['content-type'] ?? '').includes('text/markdown'))
    const mdText = await mdRes.text()
    assert.ok(mdText.startsWith('---\n'))
    assert.ok(mdText.includes('## A section heading'))
    logStep('Admin System page exports valid JSON backup, PKZIP archive, and Markdown frontmatter')

    const cspViolations = await page.evaluate(() => window.__cspViolations)
    assert.deepEqual(cspViolations, [])
    assert.deepEqual(pageErrors, [], `Uncaught page errors: ${pageErrors.join('; ')}`)
    assert.deepEqual(serverErrors, [], `Unexpected HTTP 5xx responses: ${serverErrors.join('; ')}`)

    console.log('\nAll 10 E2E browser scenarios passed with 0 page errors, 0 CSP violations, and 0 5xx errors.')
  } finally {
    await browser?.close()
    await stopServer(child)
    await rm(downloadDir, { recursive: true, force: true })
  }
}

await main()
