import type { User } from '../../lib/db/schema'
import type { AuthorWithCount } from '../../lib/db/queries/taxonomy'
import type {
  AutomationActivityWithMedia,
  AutomationRunWithArticle,
  AutomationSettings,
} from '../../lib/db/queries/automation'
import { formatDate } from '../../lib/content/html'
import { AdminLayout } from '../../components/layout'
import { CsrfField, type Flash } from './shared'

export function AutomationPage({
  user,
  settings,
  authors,
  activities,
  runs,
  hasKey,
  coverReady,
  generatedToday,
  aiCoversToday,
  session,
  flash,
}: {
  user: User
  settings: AutomationSettings
  authors: AuthorWithCount[]
  activities: AutomationActivityWithMedia[]
  runs: AutomationRunWithArticle[]
  hasKey: boolean
  coverReady: boolean
  generatedToday: number
  aiCoversToday: number
  session: { csrfToken: string }
  flash: Flash
}) {
  return (
    <AdminLayout
      user={user}
      path="/admin/automation"
      title="Automation"
      subtitle="AI-assisted drafts from daily activity"
      flash={flash}
      csrfToken={session.csrfToken}
    >
      {!hasKey ? (
        <div className="flash" data-tone="error" role="alert">
          <div>
            <strong>GEMINI_API_KEY belum diset.</strong> Tambahkan API key Gemini di environment Vercel sebelum
            menjalankan automasi.
          </div>
        </div>
      ) : null}

      <div className="admin-grid">
        <section className="admin-card" style={{ gridColumn: 'span 7' }}>
          <h2>Aktivitas hari ini</h2>
          <p className="hint" style={{ marginBottom: '1rem' }}>
            Tulis kejadian, pengamatan, atau konteks pribadi. Lampirkan foto jika ada. AI hanya memakai detail yang
            kamu berikan.
          </p>
          <form method="post" action="/admin/automation/activity" encType="multipart/form-data" className="admin-form">
            <CsrfField token={session.csrfToken} />
            <div className="field">
              <label htmlFor="context">Konteks / kejadian</label>
              <textarea
                className="textarea"
                id="context"
                name="context"
                rows={5}
                maxLength={2000}
                placeholder="Contoh: pagi ini hujan, saya menunda berangkat dan membaca ulang catatan lama..."
              />
            </div>
            <div className="field">
              <label htmlFor="image">Foto (opsional)</label>
              <input className="input" id="image" name="image" type="file" accept="image/*" />
            </div>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">Simpan aktivitas</button>
            </div>
          </form>

          <h2 style={{ marginTop: '2rem' }}>Generate draft</h2>
          <p className="hint" style={{ marginBottom: '1rem' }}>
            Memakai aktivitas terbaru yang belum diproses. Jika tidak ada, AI menulis dari initiative brief di panel
            pengaturan. Draft bisa diedit atau dipublish manual sebelum jadwal auto-publish.
          </p>
          <form method="post" action="/admin/automation/generate">
            <CsrfField token={session.csrfToken} />
            <button className="btn btn--solid" type="submit" disabled={!hasKey}>
              Generate draft sekarang
            </button>
          </form>

          <h2 style={{ marginTop: '2.5rem' }}>Aktivitas terbaru</h2>
          {activities.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Gambar</th>
                    <th>Konteks</th>
                    <th>Status</th>
                    <th>Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((activity) => (
                    <tr key={activity.id}>
                      <td>
                        {activity.media ? (
                          <img
                            src={activity.media.src}
                            alt=""
                            width={56}
                            height={56}
                            style={{ objectFit: 'cover', display: 'block' }}
                          />
                        ) : (
                          <span className="meta">—</span>
                        )}
                      </td>
                      <td className="muted-cell">
                        {activity.text ? (
                          activity.text.length > 160 ? `${activity.text.slice(0, 160)}…` : activity.text
                        ) : (
                          <span className="meta">Hanya gambar</span>
                        )}
                      </td>
                      <td>
                        <span className="status" data-status={activity.consumedAt ? 'published' : 'draft'}>
                          {activity.consumedAt ? 'used' : 'new'}
                        </span>
                      </td>
                      <td className="muted-cell">{formatDate(activity.createdAt, 'short')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="hint">Belum ada aktivitas.</p>
          )}
        </section>

        <section className="admin-card" style={{ gridColumn: 'span 5' }}>
          <h2>Pengaturan automasi</h2>
          <form method="post" action="/admin/automation/settings" className="admin-form">
            <CsrfField token={session.csrfToken} />
            <label className="field" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <input type="checkbox" name="enabled" defaultChecked={settings.enabled} />
              <span>Aktifkan automasi</span>
            </label>

            <div className="field">
              <label htmlFor="authorId">Author</label>
              <select className="select" id="authorId" name="authorId" defaultValue={settings.authorId ?? ''}>
                <option value="">Otomatis — buat author default jika kosong</option>
                {authors.map((author) => (
                  <option key={author.id} value={author.id}>{author.displayName}</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="language">Bahasa</label>
                <input
                  className="input"
                  id="language"
                  name="language"
                  list="language-options"
                  defaultValue={settings.language}
                  required
                />
                <datalist id="language-options">
                  <option value="Indonesian" />
                  <option value="English" />
                  <option value="Spanish" />
                  <option value="French" />
                  <option value="Japanese" />
                  <option value="Arabic" />
                </datalist>
              </div>
              <div className="field">
                <label htmlFor="model">Model Gemini</label>
                <input className="input" id="model" name="model" defaultValue={settings.model} required />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="autoPublishDelayHours">Auto-publish setelah (jam)</label>
                <input
                  className="input"
                  id="autoPublishDelayHours"
                  name="autoPublishDelayHours"
                  type="number"
                  min={1}
                  max={168}
                  defaultValue={settings.autoPublishDelayHours}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="dailyLimit">Artikel per 24 jam</label>
                <input
                  className="input"
                  id="dailyLimit"
                  name="dailyLimit"
                  type="number"
                  min={1}
                  max={10}
                  defaultValue={settings.dailyLimit}
                  required
                />
              </div>
            </div>
            <p className="hint" style={{ marginTop: '-0.3rem' }}>
              Terpakai dalam 24 jam terakhir: <strong>{generatedToday} / {settings.dailyLimit}</strong>. Cron akan
              membuat hingga batas ini, bisa beberapa artikel sekaligus dalam satu slot. Jika durasi fungsi habis, sisa
              kuota dilanjutkan pada cron berikutnya.
            </p>

            <label className="field" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <input type="checkbox" name="autoPublish" defaultChecked={settings.autoPublish} />
              <span>Publish otomatis jika tidak diedit</span>
            </label>

            <div className="field">
              <label htmlFor="coverMode">Cover image</label>
              <select className="select" id="coverMode" name="coverMode" defaultValue={settings.coverMode}>
                <option value="procedural">Prosedural — gratis, tanpa AI image</option>
                <option value="ai">AI — pakai provider di bawah</option>
              </select>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="aiImageProvider">Provider image</label>
                <select className="select" id="aiImageProvider" name="aiImageProvider" defaultValue={settings.aiImageProvider}>
                  <option value="cloudflare">Cloudflare Workers AI</option>
                  <option value="gemini">Gemini</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="aiImageModel">Model image</label>
                <input className="input" id="aiImageModel" name="aiImageModel" defaultValue={settings.aiImageModel} />
              </div>
            </div>
            <p className="hint" style={{ marginTop: '-0.3rem' }}>
              Cloudflare: <code>@cf/black-forest-labs/flux-1-schnell</code> · Gemini:{' '}
              <code>gemini-2.5-flash-image</code>
            </p>
            <div className="field">
              <label htmlFor="aiImageDailyLimit">Batas AI cover / 24 jam</label>
              <input
                className="input"
                id="aiImageDailyLimit"
                name="aiImageDailyLimit"
                type="number"
                min={0}
                max={10}
                defaultValue={settings.aiImageDailyLimit}
              />
            </div>
            {settings.coverMode === 'ai' && !coverReady ? (
              <div className="flash" data-tone="error" role="alert">
                Provider AI cover belum dikonfigurasi. Set <code>CLOUDFLARE_ACCOUNT_ID</code> +{' '}
                <code>CLOUDFLARE_API_TOKEN</code> untuk Cloudflare, atau <code>GEMINI_API_KEY</code> untuk Gemini.
              </div>
            ) : null}
            <p className="hint" style={{ marginTop: '-0.3rem' }}>
              AI cover hanya dipakai jika aktivitas tidak punya foto. Terpakai:{' '}
              <strong>{aiCoversToday} / {settings.aiImageDailyLimit}</strong> dalam 24 jam. Jika kuota habis atau
              generate gagal, otomatis fallback ke cover prosedural. Generate gambar memakai kuota/biaya terpisah dari
              teks; pada free tier Gemini, kuota image generation sering 0.
            </p>

            <div className="field">
              <label htmlFor="initiativeBrief">Initiative brief (saat tidak ada aktivitas)</label>
              <textarea
                className="textarea"
                id="initiativeBrief"
                name="initiativeBrief"
                rows={5}
                maxLength={2000}
                defaultValue={settings.initiativeBrief}
              />
            </div>

            <div className="form-actions">
              <button className="btn btn--solid" type="submit">Simpan pengaturan</button>
            </div>
          </form>

          <h2 style={{ marginTop: '2rem' }}>Riwayat automasi</h2>
          {runs.length ? (
            <ul className="automation-runs">
              {runs.map((run) => (
                <li key={run.id} style={{ borderTop: '1px solid var(--rule)', padding: '0.7rem 0' }}>
                  <div className="meta">
                    {formatDate(run.createdAt, 'short')} · {run.source} · {run.kind}
                  </div>
                  <div>
                    {run.articleId && run.articleTitle ? (
                      <a className="text-link" href={`/admin/articles/${run.articleId}/edit`}>{run.articleTitle}</a>
                    ) : (
                      <span>{run.error ?? 'No article'}</span>
                    )}
                  </div>
                  <div className="meta">
                    Status: {run.status} · cover: {run.coverSource ?? '—'}
                    {run.autoPublishAt ? ` · auto-publish ${formatDate(run.autoPublishAt, 'short')}` : ''}
                  </div>
                  {run.coverError ? <div className="hint">Cover fallback: {run.coverError}</div> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">Belum ada riwayat.</p>
          )}
          {settings.lastRunAt ? (
            <p className="hint" style={{ marginTop: '1rem' }}>
              Generate terakhir: {formatDate(settings.lastRunAt, 'long')}
            </p>
          ) : null}
        </section>
      </div>
    </AdminLayout>
  )
}
