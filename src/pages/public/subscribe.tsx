import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
import { NewsletterBand, SiteLayout } from '../../components/layout'
import { Kicker } from '../../components/ui'

export function SubscribePage({
  settings,
  categories,
  status,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  status?: 'ok' | 'pending' | 'exists' | 'invalid' | 'error' | null
}) {
  const message =
    status === 'ok'
      ? 'Kamu sudah masuk daftar. Terima kasih sudah berlangganan.'
      : status === 'pending'
        ? 'Cek kotak masukmu dan klik tautan konfirmasi untuk bergabung.'
        : status === 'exists'
          ? 'Alamat itu sudah berlangganan.'
          : status === 'invalid'
            ? 'Alamat surel itu sepertinya tidak tepat. Mohon diperiksa dan coba lagi.'
            : status === 'error'
              ? 'Ada yang gagal saat menyimpan alamatmu. Coba lagi sebentar lagi.'
              : null

  return (
    <SiteLayout settings={settings} categories={categories} path="/subscribe">
      <section className="page-hero">
        <div className="shell">
          <div className="page-hero__grid">
            <div>
              <Kicker plain>Surat kabar</Kicker>
              <h1 className="display-lg" style={{ marginTop: '1rem' }}>Berlangganan</h1>
            </div>
            <div>
              <p>
                Sebuah catatan ketika ada sesuatu yang layak dikirim. Esai baru, serpihan sesekali, tanpa jadwal yang
                harus dikejar.
              </p>
              <div className="page-hero__meta">
                <a className="text-link" href="/rss.xml">Lebih suka RSS? →</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {message ? (
        <div className="shell" style={{ paddingTop: '1.5rem' }}>
          <div className="flash" data-tone={status === 'ok' || status === 'pending' || status === 'exists' ? 'success' : 'error'} role="status">
            {message}
          </div>
        </div>
      ) : null}

      <NewsletterBand settings={settings} />

      <div className="shell">
        <div className="about-layout" style={{ paddingTop: 'clamp(2rem, 4vw, 3rem)' }}>
          <div className="about-copy">
            <h2 style={{ marginTop: 0 }}>Apa yang terjadi saat kamu berlangganan</h2>
            <p>
              Alamatmu diperiksa dan disimpan dengan aman di basis data situs ini sendiri. Kamu akan menerima surel
              konfirmasi; klik tautan di pesan itu untuk bergabung. Alamat hanya dipakai untuk surat kabar ini dan
              tidak pernah dibagikan atau dijual. Kamu bisa berhenti kapan saja lewat tautan berhenti berlangganan di
              setiap surat, atau dengan menghubungi Rhandyta Briantama.
            </p>
            <h2>Privasi</h2>
            <p>
              Alamatmu hanya dipakai untuk mengirim surat kabar. Tidak pernah dijual atau dibagikan. Untuk meminta
              penghapusan, gunakan tautan berhenti berlangganan di setiap surat atau hubungi Rhandyta Briantama.
            </p>
          </div>
          <aside className="about-aside">
            <h2>Jalur lain</h2>
            <ul>
              <li><a href="/rss.xml">Umpan RSS</a></li>
              <li><a href="/articles">Semua artikel</a></li>
              <li><a href="/about">Tentang publikasi</a></li>
            </ul>
          </aside>
        </div>
      </div>
    </SiteLayout>
  )
}

export function ConfirmPage({
  settings,
  categories,
  status,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  status: 'done' | 'invalid'
}) {
  return (
    <SiteLayout settings={settings} categories={categories} path="/confirm">
      <section className="page-hero">
        <div className="shell">
          <Kicker plain>Surat kabar</Kicker>
          <h1 className="display-lg" style={{ marginTop: '1rem' }}>
            {status === 'done' ? 'Langganan terkonfirmasi.' : 'Tautan ini tidak valid atau sudah kedaluwarsa.'}
          </h1>
          <p className="lede" style={{ marginTop: '1.5rem', maxWidth: '46ch' }}>
            {status === 'done'
              ? 'Kamu sudah masuk daftar. Halaman ini boleh ditutup.'
              : 'Token konfirmasi tidak dapat diverifikasi. Berlangganan lagi untuk menerima tautan baru.'}
          </p>
          <p style={{ marginTop: '1.75rem' }}>
            <a className="btn btn--ghost" href="/">Kembali ke beranda</a>
          </p>
        </div>
      </section>
    </SiteLayout>
  )
}

export function UnsubscribePage({
  settings,
  categories,
  status,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  status: 'done' | 'invalid'
}) {
  return (
    <SiteLayout settings={settings} categories={categories} path="/unsubscribe">
      <section className="page-hero">
        <div className="shell">
          <Kicker plain>Surat kabar</Kicker>
          <h1 className="display-lg" style={{ marginTop: '1rem' }}>
            {status === 'done' ? 'Kamu sudah berhenti berlangganan.' : 'Tautan ini tidak valid.'}
          </h1>
          <p className="lede" style={{ marginTop: '1.5rem', maxWidth: '46ch' }}>
            {status === 'done'
              ? 'Alamatmu sudah dihapus dari daftar surat kabar. Kamu tidak akan menerima surat berikutnya.'
              : 'Token berhenti berlangganan tidak dapat diverifikasi. Jika menurutmu ini keliru, gunakan alamat kontak di halaman tentang.'}
          </p>
          <p style={{ marginTop: '1.75rem' }}>
            <a className="btn btn--ghost" href="/">Kembali ke beranda</a>
          </p>
        </div>
      </section>
    </SiteLayout>
  )
}
