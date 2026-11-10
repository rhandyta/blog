import { AdminLayout } from '../../components/layout'
import type {
  AutomationActivityWithMedia,
  AutomationRunWithArticle,
  AutomationSettings,
} from '../../lib/db/queries/automation'
import type { AuthorWithCount } from '../../lib/db/queries/taxonomy'
import type { User } from '../../lib/db/schema'
import { useI18n } from '../../lib/i18n'
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
  const { t, formatDate, formatNumber, href } = useI18n()
  const generatedCount = formatNumber(generatedToday)
  const generationLimit = formatNumber(settings.dailyLimit)
  const aiCoverCount = formatNumber(aiCoversToday)
  const aiCoverLimit = formatNumber(settings.aiImageDailyLimit)
  const usageSuffix = t('adminAutomation.settings.usageSuffix')
  const aiUsageSuffix = t('adminAutomation.settings.aiUsageSuffix')
  return (
    <AdminLayout
      user={user}
      path="/admin/automation"
      title={t('adminAutomation.header.title')}
      subtitle={t('adminAutomation.header.subtitle')}
      flash={flash}
      csrfToken={session.csrfToken}
    >
      {!hasKey ? (
        <div className="flash" data-tone="error" role="alert">
          <div>
            <strong>{t('adminAutomation.keyAlert.title')}</strong> {t('adminAutomation.keyAlert.body')}
          </div>
        </div>
      ) : null}

      <div className="admin-grid">
        <section className="admin-card" style={{ gridColumn: 'span 7' }}>
          <h2>{t('adminAutomation.activity.title')}</h2>
          <p className="hint" style={{ marginBottom: '1rem' }}>
            {t('adminAutomation.activity.intro')}
          </p>
          <form method="post" action="/admin/automation/activity" encType="multipart/form-data" className="admin-form">
            <CsrfField token={session.csrfToken} />
            <div className="field">
              <label htmlFor="context">{t('adminAutomation.activity.contextLabel')}</label>
              <textarea
                className="textarea"
                id="context"
                name="context"
                rows={5}
                maxLength={2000}
                placeholder={t('adminAutomation.activity.contextPlaceholder')}
              />
            </div>
            <div className="field">
              <label htmlFor="image">{t('adminAutomation.activity.photoLabel')}</label>
              <input className="input" id="image" name="image" type="file" accept="image/*" />
            </div>
            <div className="form-actions">
              <button className="btn btn--solid" type="submit">
                {t('adminAutomation.activity.submit')}
              </button>
            </div>
          </form>

          <h2 style={{ marginTop: '2rem' }}>{t('adminAutomation.generate.title')}</h2>
          <p className="hint" style={{ marginBottom: '1rem' }}>
            {t('adminAutomation.generate.intro')}
          </p>
          <form method="post" action="/admin/automation/generate">
            <CsrfField token={session.csrfToken} />
            <button className="btn btn--solid" type="submit" disabled={!hasKey}>
              {t('adminAutomation.generate.submit')}
            </button>
          </form>

          <h2 style={{ marginTop: '2.5rem' }}>{t('adminAutomation.activity.recentTitle')}</h2>
          {activities.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t('adminAutomation.activity.imageHeader')}</th>
                    <th>{t('adminAutomation.activity.contextHeader')}</th>
                    <th>{t('adminAutomation.activity.statusHeader')}</th>
                    <th>{t('adminAutomation.activity.timeHeader')}</th>
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
                          activity.text.length > 160 ? (
                            `${activity.text.slice(0, 160)}…`
                          ) : (
                            activity.text
                          )
                        ) : (
                          <span className="meta">{t('adminAutomation.activity.imageOnly')}</span>
                        )}
                      </td>
                      <td>
                        <span className="status" data-status={activity.consumedAt ? 'published' : 'draft'}>
                          {t(`adminAutomation.status.${activity.consumedAt ? 'used' : 'new'}`)}
                        </span>
                      </td>
                      <td className="muted-cell">{formatDate(activity.createdAt, 'short')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="hint">{t('adminAutomation.activity.empty')}</p>
          )}
        </section>

        <section className="admin-card" style={{ gridColumn: 'span 5' }}>
          <h2>{t('adminAutomation.settings.title')}</h2>
          <form method="post" action="/admin/automation/settings" className="admin-form">
            <CsrfField token={session.csrfToken} />
            <label className="field" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <input type="checkbox" name="enabled" defaultChecked={settings.enabled} />
              <span>{t('adminAutomation.settings.enable')}</span>
            </label>

            <div className="field">
              <label htmlFor="authorId">{t('adminAutomation.settings.authorLabel')}</label>
              <select className="select" id="authorId" name="authorId" defaultValue={settings.authorId ?? ''}>
                <option value="">{t('adminAutomation.settings.authorAuto')}</option>
                {authors.map((author) => (
                  <option key={author.id} value={author.id}>
                    {author.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="language">{t('adminAutomation.settings.languageLabel')}</label>
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
                <label htmlFor="model">{t('adminAutomation.settings.modelLabel')}</label>
                <input className="input" id="model" name="model" defaultValue={settings.model} required />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="autoPublishDelayHours">{t('adminAutomation.settings.autoPublishAfter')}</label>
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
                <label htmlFor="dailyLimit">{t('adminAutomation.settings.dailyLimit')}</label>
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
            {/* biome-ignore format: the suffix must sit flush against the strong element */}
            <p className="hint" style={{ marginTop: '-0.3rem' }}>
              {t('adminAutomation.settings.usagePrefix')}{' '}
              <strong>{generatedCount} / {generationLimit}</strong>{usageSuffix}
            </p>

            <label className="field" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <input type="checkbox" name="autoPublish" defaultChecked={settings.autoPublish} />
              <span>{t('adminAutomation.settings.autoPublish')}</span>
            </label>

            <div className="field">
              <label htmlFor="coverMode">{t('adminAutomation.settings.coverLabel')}</label>
              <select className="select" id="coverMode" name="coverMode" defaultValue={settings.coverMode}>
                <option value="procedural">{t('adminAutomation.settings.coverProcedural')}</option>
                <option value="ai">{t('adminAutomation.settings.coverAi')}</option>
              </select>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="aiImageProvider">{t('adminAutomation.settings.providerLabel')}</label>
                <select
                  className="select"
                  id="aiImageProvider"
                  name="aiImageProvider"
                  defaultValue={settings.aiImageProvider}
                >
                  <option value="cloudflare">Cloudflare Workers AI</option>
                  <option value="gemini">Gemini</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="aiImageModel">{t('adminAutomation.settings.imageModelLabel')}</label>
                <input className="input" id="aiImageModel" name="aiImageModel" defaultValue={settings.aiImageModel} />
              </div>
            </div>
            <p className="hint" style={{ marginTop: '-0.3rem' }}>
              Cloudflare: <code>@cf/black-forest-labs/flux-1-schnell</code> · Gemini:{' '}
              <code>gemini-2.5-flash-image</code>
            </p>
            <div className="field">
              <label htmlFor="aiImageDailyLimit">{t('adminAutomation.settings.aiCoverLimit')}</label>
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
                {t('adminAutomation.settings.coverMissing')} <code>CLOUDFLARE_ACCOUNT_ID</code> +{' '}
                <code>CLOUDFLARE_API_TOKEN</code> {t('adminAutomation.settings.coverMissingCloudflare')}{' '}
                <code>GEMINI_API_KEY</code> {t('adminAutomation.settings.coverMissingGemini')}
              </div>
            ) : null}
            {/* biome-ignore format: the suffix must sit flush against the strong element */}
            <p className="hint" style={{ marginTop: '-0.3rem' }}>
              {t('adminAutomation.settings.aiUsagePrefix')}{' '}
              <strong>{aiCoverCount} / {aiCoverLimit}</strong>{aiUsageSuffix}
            </p>

            <div className="field">
              <label htmlFor="initiativeBrief">{t('adminAutomation.settings.briefLabel')}</label>
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
              <button className="btn btn--solid" type="submit">
                {t('adminAutomation.settings.save')}
              </button>
            </div>
          </form>

          <h2 style={{ marginTop: '2rem' }}>{t('adminAutomation.history.title')}</h2>
          {runs.length ? (
            <ul className="automation-runs">
              {runs.map((run) => (
                <li key={run.id} style={{ borderTop: '1px solid var(--rule)', padding: '0.7rem 0' }}>
                  <div className="meta">
                    {formatDate(run.createdAt, 'short')} · {t(`adminAutomation.status.${run.source}`)} ·{' '}
                    {t(`adminAutomation.status.${run.kind}`)}
                  </div>
                  <div>
                    {run.articleId && run.articleTitle ? (
                      <a className="text-link" href={href(`/admin/articles/${run.articleId}/edit`)}>
                        {run.articleTitle}
                      </a>
                    ) : (
                      <span>{run.error ?? t('adminAutomation.run.noArticle')}</span>
                    )}
                  </div>
                  <div className="meta">
                    {t('adminAutomation.run.statusLine', {
                      status: t(`adminAutomation.status.${run.status}`),
                      cover: run.coverSource ? t(`adminAutomation.status.${run.coverSource}`) : '—',
                    })}
                    {run.autoPublishAt
                      ? ` · ${t('adminAutomation.run.autoPublish', { date: formatDate(run.autoPublishAt, 'short') })}`
                      : ''}
                  </div>
                  {run.coverError ? (
                    <div className="hint">{t('adminAutomation.run.coverFallback', { error: run.coverError })}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">{t('adminAutomation.history.empty')}</p>
          )}
          {settings.lastRunAt ? (
            <p className="hint" style={{ marginTop: '1rem' }}>
              {t('adminAutomation.history.lastRun', { date: formatDate(settings.lastRunAt, 'long') })}
            </p>
          ) : null}
        </section>
      </div>
    </AdminLayout>
  )
}
