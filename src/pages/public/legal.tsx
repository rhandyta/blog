import type { ReactNode } from 'react'
import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
import { SiteLayout } from '../../components/layout'
import { Kicker } from '../../components/ui'

function LegalShell({
  settings,
  categories,
  path,
  kicker,
  title,
  updated,
  children,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  path: string
  kicker: string
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <SiteLayout settings={settings} categories={categories} path={path}>
      <section className="page-hero">
        <div className="shell">
          <Kicker plain>{kicker}</Kicker>
          <h1 className="display-lg" style={{ marginTop: '1rem' }}>{title}</h1>
          <p className="meta" style={{ marginTop: '0.75rem' }}>Terakhir diperbarui {updated}</p>
        </div>
      </section>
      <div className="shell">
        <div className="about-layout" style={{ paddingTop: 'clamp(2rem, 4vw, 3rem)' }}>
          <div className="about-copy">{children}</div>
          <aside className="about-aside">
            <h2>Kontak</h2>
            <p>
              Rhandyta Briantama<br />
              {settings.email ? <a href={`mailto:${settings.email}`}>{settings.email}</a> : null}
            </p>
            <p className="meta" style={{ marginTop: '1rem' }}>
              Halaman ini adalah kebijakan berbahasa sederhana untuk publikasi personal, bukan pengganti nasihat hukum.
            </p>
          </aside>
        </div>
      </div>
    </SiteLayout>
  )
}

export function PrivacyPage({
  settings,
  categories,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
}) {
  return (
    <LegalShell
      settings={settings}
      categories={categories}
      path="/privacy"
      kicker="Privasi"
      title="Kebijakan privasi"
      updated="8 November 2026"
    >
      <p>
        RhandytaVERSE adalah publikasi personal yang ditulis dan disunting oleh Rhandyta Briantama. Kebijakan ini
        menjelaskan data apa yang dikumpulkan situs ini, mengapa dikumpulkan, dan bagaimana meminta penghapusannya.
      </p>

      <h2>Surat kabar</h2>
      <p>
        Jika kamu berlangganan, saya menyimpan alamat surelmu, status langganan, sumber, serta waktu konfirmasi dan
        berhenti berlangganan. Pelanggan baru harus mengonfirmasi lewat surel sebelum masuk daftar. Saya memakai Resend
        untuk mengirim pesan konfirmasi dan surat kabar; Resend memproses alamat dan data pengiriman atas nama saya.
      </p>
      <p>
        Alamatmu hanya dipakai untuk surat kabar dan tidak pernah dijual. Kamu bisa berhenti berlangganan dari surat
        mana pun lewat tautan berhenti berlangganan, atau meminta saya menghapus alamatmu. Menghapus pelanggan dari
        meja editorial akan menghapus data pelanggan yang tersimpan.
      </p>

      <h2>Pembaca dan analitik pengunjung</h2>
      <p>
        Analitik internal meja editorial mengukur pembaca tanpa cookie analitik internal, jaringan iklan, atau
        penyimpanan alamat IP dan user-agent mentah. Pengenal pengunjung adalah hash bergaram yang hanya dipakai untuk
        menghapus duplikasi kunjungan; alamat IP disamarkan sebelum di-hash. Saya menyimpan informasi kasar tentang
        perangkat, peramban, sistem operasi, negara, dan host perujuk eksternal untuk laporan agregat.
      </p>
      <p>
        Peristiwa analitik internal disimpan 180 hari, sementara jumlah pembaca unik agregat tetap disimpan agar total
        artikel tetap bermakna. Permintaan DNT dan Global Privacy Control dikecualikan dari analitik internal. Kunjungan
        internal/admin, bot, dan prefetch juga dikecualikan.
      </p>
      <p>
        Selain analitik internal tersebut, halaman publik (tidak termasuk meja editorial dan halaman pratinjau)
        memuat Google Tag Manager (<code>googletagmanager.com</code>) untuk pengukuran trafik situs. Pemroses pihak
        ketiga ini beroperasi sesuai pengaturan peramban atau pemblokir skrip yang kamu gunakan serta kebijakan privasi
        Google.
      </p>

      <h2>Hosting dan pemroses data</h2>
      <p>
        Situs berjalan di Vercel, memakai Turso untuk basis data produksi, Vercel Blob untuk media, Resend untuk
        surel, dan Google Tag Manager pada halaman publik untuk pengukuran trafik. Penyedia tersebut memproses data
        sebagai infrastruktur atau layanan pengukuran terkait. Saya tidak menjual data pribadi atau menayangkan iklan.
      </p>

      <h2>Cookie dan penyimpanan lokal</h2>
      <p>
        Situs inti dan analitik internal tidak menyetel cookie analitik sendiri. Pada halaman publik, Google Tag
        Manager dapat memuat tag pengukuran atau cookie pihak ketiga sesuai konfigurasi Google Analytics. Meja
        editorial memakai cookie sesi pihak pertama (<code>sid</code>) untuk autentikasi penulis dan penyunting. Situs
        juga memakai penyimpanan lokal peramban untuk preferensi tema warna dan daftar artikel tersimpan; preferensi
        tersebut tetap berada di perambanmu.
      </p>

      <h2>Pilihanmu</h2>
      <p>
        Kamu bisa berhenti berlangganan kapan saja, meminta salinan data pelangganmu, atau meminta penghapusan. Kirim
        surel ke {settings.email ? <a href={`mailto:${settings.email}`}>{settings.email}</a> : 'alamat kontak'} dengan
        alamat yang kamu pakai. Karena pengenal analitik tidak terhubung ke alamat surel pelanggan, saya tidak dapat
        menghubungkan catatan analitik ke orang tertentu.
      </p>

      <h2>Perubahan</h2>
      <p>
        Jika kebijakan ini berubah secara material, tanggal “terakhir diperbarui” di atas akan berubah. Melanjutkan
        penggunaan situs setelah perubahan berarti kamu menerima kebijakan yang direvisi.
      </p>
    </LegalShell>
  )
}

export function TermsPage({
  settings,
  categories,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
}) {
  return (
    <LegalShell
      settings={settings}
      categories={categories}
      path="/terms"
      kicker="Ketentuan"
      title="Ketentuan penggunaan"
      updated="6 November 2026"
    >
      <p>
        Ketentuan ini berlaku untuk RhandytaVERSE, publikasi personal yang dijalankan oleh Rhandyta Briantama. Dengan
        membaca atau berlangganan, kamu menyetujuinya.
      </p>

      <h2>Konten</h2>
      <p>
        Esai, catatan, gambar, dan materi lain di situs ini ditulis atau dipesan oleh Rhandyta Briantama kecuali
        dinyatakan lain. Kamu boleh mengutip potongan singkat dengan atribusi dan tautan. Jangan menerbitkan ulang
        bagian yang substansial, mengambil arsip untuk pelatihan model, atau mengklaim karya ini sebagai milikmu tanpa
        izin.
      </p>

      <h2>Surat kabar</h2>
      <p>
        Surat kabar ini adalah surat personal, bukan layanan berita atau jadwal yang dijanjikan. Langganan memerlukan
        konfirmasi. Kamu bisa berhenti kapan saja. Jangan mendaftarkan alamat yang bukan milikmu.
      </p>

      <h2>Penggunaan yang wajar</h2>
      <p>
        Jangan mencoba mengganggu situs, melewati kontrol akses, mengambil data dengan laju yang memperlambat layanan,
        atau memakai formulir kontak/surat kabar untuk spam, pelecehan, atau aktivitas melanggar hukum.
      </p>

      <h2>Tautan pihak ketiga</h2>
      <p>
        Tautan ke situs lain disediakan sebagai konteks. Saya tidak mengendalikan situs tersebut dan tidak bertanggung
        jawab atas isi, ketersediaan, atau praktik privasinya.
      </p>

      <h2>Tanpa jaminan</h2>
      <p>
        Publikasi ini disediakan apa adanya. Saya mengupayakan ketepatan, tetapi tidak menjamin setiap pernyataan
        lengkap, mutakhir, atau cocok untuk tujuan tertentu. Tidak ada di sini yang merupakan nasihat profesional,
        hukum, keuangan, atau medis.
      </p>

      <h2>Perubahan</h2>
      <p>
        Saya dapat memperbarui ketentuan ini; tanggal “terakhir diperbarui” akan berubah. Perubahan material akan
        tercermin di halaman ini. Pertanyaan bisa dikirim ke {settings.email ? <a href={`mailto:${settings.email}`}>{settings.email}</a> : 'alamat kontak'}.
      </p>
    </LegalShell>
  )
}
