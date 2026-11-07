import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
import type { Author } from '../../lib/db/schema'
import { splitParagraphs } from '../../lib/content/html'
import { ui } from '../../lib/content/ui-copy'
import { SiteLayout } from '../../components/layout'
import { Kicker } from '../../components/ui'

export function AboutPage({
  settings,
  categories,
  articleCount,
  author,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  articleCount: number
  author: Author | null
}) {
  const paragraphs = splitParagraphs(settings.about)
  const personName = author?.displayName ?? 'Rhandyta Briantama'
  const personSlug = author?.slug ?? 'rhandyta-briantama'
  return (
    <SiteLayout settings={settings} categories={categories} path="/about">
      <section className="about-hero">
        <div className="shell">
          <Kicker plain>{ui.about.kicker}</Kicker>
          <h1 style={{ marginTop: '1rem' }}>
            {settings.title} adalah {personName}.
          </h1>
          <p className="lede" style={{ marginTop: '1.5rem', maxWidth: '46ch' }}>
            {ui.about.lede}
          </p>
        </div>
      </section>

      <div className="shell">
        <div className="about-layout">
          <div className="about-copy">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}

            <h2>Orang di balik publikasi ini</h2>
            <p>
              <strong>{personName}</strong> menulis dan menyunting {settings.title}. Publikasi ini bukan merek
              terpisah dengan suara yang terpisah; ia adalah catatan kerja satu orang, yang dirawat di depan umum.
            </p>
            <p>
              <a className="text-link" href={`/author/${personSlug}`}>{ui.about.readAuthor} →</a>
            </p>

            <h2>Apa yang akan kamu temukan di sini</h2>
            <p>
              Esai dan catatan tentang teknologi, desain, sains, budaya, pekerjaan, dan urusan biasa dalam
              memperhatikan sesuatu. Subjeknya sengaja tidak dibatasi. Publikasi ini tidak punya satu subjek, karena
              seseorang juga tidak punya satu subjek.
            </p>
            <p>
              Tulisan diarsipkan menurut rubrik, ditandai tag secara longgar, dan disimpan dalam arsip kronologis yang
              utuh. Tidak ada yang diletakkan di balik paywall, akun, atau modal.
            </p>

            <blockquote>{settings.manifesto}</blockquote>

            <h2>Bagaimana ini dibuat</h2>
            <p>
              {settings.title} adalah platform penerbitan kecil yang berdiri sendiri. Halaman dirender di server, teks
              disimpan dalam basis data SQLite serverless, gambar diproses menjadi format modern saat diunggah, dan
              JavaScript sisi klien hanya mencakup beberapa interaksi: pergantian tema, kemajuan membaca, pencarian,
              dan menyimpan artikel untuk nanti.
            </p>
            <p>
              Huruf disajikan bersama situs ini, bukan diambil dari pihak ketiga. Tidak ada pelacak, tidak ada skrip
              iklan, dan tidak ada analitik eksternal. Pembaca diukur sendiri tanpa cookie analitik dan tanpa alamat
              IP mentah.
            </p>

            <h2>Independensi editorial</h2>
            <p>
              {settings.title} ditulis dan disunting secara independen oleh {personName}. Tidak ada yang terbit
              menurut jadwal tetap; tulisan ditambahkan ketika ada sesuatu yang layak disampaikan. Arsip disimpan
              utuh, dan koreksi dicatat di dalam tulisan, bukan dihapus diam-diam.
            </p>

            <h2>{ui.about.correspondence}</h2>
            <p>
              Untuk publikasi sebesar ini, alamat yang tepat adalah surel biasa. Koreksi dicatat di dalam tulisan,
              bukan dihapus diam-diam. Jika ada yang keliru di sini, sampaikan.
            </p>
          </div>

          <aside className="about-aside">
            <h2>Kolofon</h2>
            <ul>
              <li><span className="meta">Penyunting</span><br />{personName}</li>
              <li><span className="meta">Edisi</span><br />{settings.issue}</li>
              <li><span className="meta">Rubrik</span><br />{categories.length}</li>
              <li><span className="meta">Tulisan</span><br />{articleCount}</li>
              <li><span className="meta">Tipografi</span><br />Fraunces &amp; Newsreader</li>
              <li><span className="meta">Mesin</span><br />Bun, Hono, React SSR, SQLite</li>
            </ul>
            <h2 style={{ marginTop: '2rem' }}>{ui.footer.elsewhere}</h2>
            <ul>
              <li><a href="/rss.xml">{ui.footer.rss}</a></li>
              <li><a href="/subscribe">{ui.footer.newsletter}</a></li>
              <li><a href="/privacy">{ui.footer.privacy}</a></li>
              <li><a href="/terms">{ui.footer.terms}</a></li>
              {settings.email ? <li><a href={`mailto:${settings.email}`}>{settings.email}</a></li> : null}
              {settings.github ? (
                <li><a href={settings.github} rel="noopener noreferrer" target="_blank">GitHub ↗</a></li>
              ) : null}
              <li><a href="/admin">{ui.footer.editorialDesk}</a></li>
            </ul>
            <p className="meta" style={{ marginTop: '2rem', lineHeight: 1.8 }}>
              Tanpa pelacak pihak ketiga. Tanpa iklan. Pengukuran pembaca dilakukan sendiri, tanpa cookie.
            </p>
          </aside>
        </div>
      </div>
    </SiteLayout>
  )
}
