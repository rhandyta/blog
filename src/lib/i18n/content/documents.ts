import type { Locale } from '../locale'

/**
 * Long-form editorial pages. These are content documents rather than interface
 * strings, so they keep their structure (sections, paragraphs) instead of being
 * flattened into the message catalogue.
 */

export type DocumentSection = { heading: string | null; paragraphs: string[] }

export type LegalDocument = {
  kicker: string
  title: string
  /** ISO date; rendered with the active locale by the page. */
  updated: string
  sections: DocumentSection[]
}

const privacyId: LegalDocument = {
  kicker: 'Privasi',
  title: 'Kebijakan privasi',
  updated: '2026-11-08',
  sections: [
    {
      heading: null,
      paragraphs: [
        'RhandytaVERSE adalah publikasi personal yang ditulis dan disunting oleh Rhandyta Briantama. Kebijakan ini menjelaskan data apa yang dikumpulkan situs ini, mengapa dikumpulkan, dan bagaimana meminta penghapusannya.',
      ],
    },
    {
      heading: 'Surat kabar',
      paragraphs: [
        'Jika kamu berlangganan, saya menyimpan alamat surelmu, status langganan, sumber, serta waktu konfirmasi dan berhenti berlangganan. Pelanggan baru harus mengonfirmasi lewat surel sebelum masuk daftar. Saya memakai Resend untuk mengirim pesan konfirmasi dan surat kabar; Resend memproses alamat dan data pengiriman atas nama saya.',
        'Alamatmu hanya dipakai untuk surat kabar dan tidak pernah dijual. Kamu bisa berhenti berlangganan dari surat mana pun lewat tautan berhenti berlangganan, atau meminta saya menghapus alamatmu. Menghapus pelanggan dari meja editorial akan menghapus data pelanggan yang tersimpan.',
      ],
    },
    {
      heading: 'Pembaca dan analitik pengunjung',
      paragraphs: [
        'Analitik internal meja editorial mengukur pembaca tanpa cookie analitik internal, jaringan iklan, atau penyimpanan alamat IP dan user-agent mentah. Pengenal pengunjung adalah hash bergaram yang hanya dipakai untuk menghapus duplikasi kunjungan; alamat IP disamarkan sebelum di-hash. Saya menyimpan informasi kasar tentang perangkat, peramban, sistem operasi, negara, dan host perujuk eksternal untuk laporan agregat.',
        'Peristiwa analitik internal disimpan 180 hari, sementara jumlah pembaca unik agregat tetap disimpan agar total artikel tetap bermakna. Permintaan DNT dan Global Privacy Control dikecualikan dari analitik internal. Kunjungan internal/admin, bot, dan prefetch juga dikecualikan.',
        'Selain analitik internal tersebut, halaman publik (tidak termasuk meja editorial dan halaman pratinjau) memuat Google Tag Manager (googletagmanager.com) untuk pengukuran trafik situs. Pemroses pihak ketiga ini beroperasi sesuai pengaturan peramban atau pemblokir skrip yang kamu gunakan serta kebijakan privasi Google.',
      ],
    },
    {
      heading: 'Hosting dan pemroses data',
      paragraphs: [
        'Situs berjalan di Vercel, memakai Turso untuk basis data produksi, Vercel Blob untuk media, Resend untuk surel, dan Google Tag Manager pada halaman publik untuk pengukuran trafik. Penyedia tersebut memproses data sebagai infrastruktur atau layanan pengukuran terkait. Saya tidak menjual data pribadi atau menayangkan iklan.',
      ],
    },
    {
      heading: 'Cookie dan penyimpanan lokal',
      paragraphs: [
        'Situs inti dan analitik internal tidak menyetel cookie analitik sendiri. Pada halaman publik, Google Tag Manager dapat memuat tag pengukuran atau cookie pihak ketiga sesuai konfigurasi Google Analytics. Meja editorial memakai cookie sesi pihak pertama (sid) untuk autentikasi penulis dan penyunting. Situs juga memakai cookie bahasa dan penyimpanan lokal peramban untuk preferensi tema warna serta daftar artikel tersimpan; preferensi tersebut tetap berada di perambanmu.',
      ],
    },
    {
      heading: 'Pilihanmu',
      paragraphs: [
        'Kamu bisa berhenti berlangganan kapan saja, meminta salinan data pelangganmu, atau meminta penghapusan. Kirim surel ke {{email}} dengan alamat yang kamu pakai. Karena pengenal analitik tidak terhubung ke alamat surel pelanggan, saya tidak dapat menghubungkan catatan analitik ke orang tertentu.',
      ],
    },
    {
      heading: 'Perubahan',
      paragraphs: [
        'Jika kebijakan ini berubah secara material, tanggal “terakhir diperbarui” di atas akan berubah. Melanjutkan penggunaan situs setelah perubahan berarti kamu menerima kebijakan yang direvisi.',
      ],
    },
  ],
}

const privacyEn: LegalDocument = {
  kicker: 'Privacy',
  title: 'Privacy policy',
  updated: '2026-11-08',
  sections: [
    {
      heading: null,
      paragraphs: [
        'RhandytaVERSE is a personal publication written and edited by Rhandyta Briantama. This policy explains what data this site collects, why it is collected, and how to ask for its removal.',
      ],
    },
    {
      heading: 'The newsletter',
      paragraphs: [
        'If you subscribe, I store your email address, subscription status, source, and the timestamps for confirmation and unsubscription. New subscribers must confirm by email before joining the list. I use Resend to send confirmation messages and the newsletter; Resend processes addresses and delivery data on my behalf.',
        'Your address is used only for the newsletter and is never sold. You can unsubscribe from any letter through the unsubscribe link, or ask me to delete your address. Deleting a subscriber from the editorial desk deletes the stored subscriber record.',
      ],
    },
    {
      heading: 'Readers and visitor analytics',
      paragraphs: [
        'The editorial desk’s internal analytics measure readers without internal analytics cookies, advertising networks, or storage of raw IP addresses and user agents. The visitor identifier is a salted hash used only to remove duplicate visits; the IP address is obscured before hashing. I keep coarse information about device, browser, operating system, country, and external referrer host for aggregate reports.',
        'Internal analytics events are kept for 180 days, while aggregate unique reader counts are retained so article totals stay meaningful. Do Not Track and Global Privacy Control requests are excluded from internal analytics. Internal/admin visits, bots, and prefetches are excluded as well.',
        'Beyond that internal analytics, public pages (excluding the editorial desk and preview pages) load Google Tag Manager (googletagmanager.com) for site traffic measurement. That third-party processor operates according to the browser settings or script blocker you use and Google’s privacy policy.',
      ],
    },
    {
      heading: 'Hosting and data processors',
      paragraphs: [
        'The site runs on Vercel, uses Turso for the production database, Vercel Blob for media, Resend for email, and Google Tag Manager on public pages for traffic measurement. Those providers process data as infrastructure or related measurement services. I do not sell personal data or display advertising.',
      ],
    },
    {
      heading: 'Cookies and local storage',
      paragraphs: [
        'The core site and internal analytics do not set their own analytics cookies. On public pages, Google Tag Manager may load measurement tags or third-party cookies according to the Google Analytics configuration. The editorial desk uses a first-party session cookie (sid) to authenticate writers and editors. The site also uses a language cookie and browser local storage for the colour theme preference and the saved-article list; those preferences stay in your browser.',
      ],
    },
    {
      heading: 'Your choices',
      paragraphs: [
        'You can unsubscribe at any time, ask for a copy of your subscriber data, or ask for deletion. Email {{email}} from the address you used. Because analytics identifiers are not linked to subscriber email addresses, I cannot connect analytics records to a specific person.',
      ],
    },
    {
      heading: 'Changes',
      paragraphs: [
        'If this policy changes materially, the “last updated” date above will change. Continuing to use the site after a change means you accept the revised policy.',
      ],
    },
  ],
}

const termsId: LegalDocument = {
  kicker: 'Ketentuan',
  title: 'Ketentuan penggunaan',
  updated: '2026-11-06',
  sections: [
    {
      heading: null,
      paragraphs: [
        'Ketentuan ini berlaku untuk RhandytaVERSE, publikasi personal yang dijalankan oleh Rhandyta Briantama. Dengan membaca atau berlangganan, kamu menyetujuinya.',
      ],
    },
    {
      heading: 'Konten',
      paragraphs: [
        'Esai, catatan, gambar, dan materi lain di situs ini ditulis atau dipesan oleh Rhandyta Briantama kecuali dinyatakan lain. Kamu boleh mengutip potongan singkat dengan atribusi dan tautan. Jangan menerbitkan ulang bagian yang substansial, mengambil arsip untuk pelatihan model, atau mengklaim karya ini sebagai milikmu tanpa izin.',
      ],
    },
    {
      heading: 'Surat kabar',
      paragraphs: [
        'Surat kabar ini adalah surat personal, bukan layanan berita atau jadwal yang dijanjikan. Langganan memerlukan konfirmasi. Kamu bisa berhenti kapan saja. Jangan mendaftarkan alamat yang bukan milikmu.',
      ],
    },
    {
      heading: 'Penggunaan yang wajar',
      paragraphs: [
        'Jangan mencoba mengganggu situs, melewati kontrol akses, mengambil data dengan laju yang memperlambat layanan, atau memakai formulir kontak/surat kabar untuk spam, pelecehan, atau aktivitas melanggar hukum.',
      ],
    },
    {
      heading: 'Tautan pihak ketiga',
      paragraphs: [
        'Tautan ke situs lain disediakan sebagai konteks. Saya tidak mengendalikan situs tersebut dan tidak bertanggung jawab atas isi, ketersediaan, atau praktik privasinya.',
      ],
    },
    {
      heading: 'Tanpa jaminan',
      paragraphs: [
        'Publikasi ini disediakan apa adanya. Saya mengupayakan ketepatan, tetapi tidak menjamin setiap pernyataan lengkap, mutakhir, atau cocok untuk tujuan tertentu. Tidak ada di sini yang merupakan nasihat profesional, hukum, keuangan, atau medis.',
      ],
    },
    {
      heading: 'Perubahan',
      paragraphs: [
        'Saya dapat memperbarui ketentuan ini; tanggal “terakhir diperbarui” akan berubah. Perubahan material akan tercermin di halaman ini. Pertanyaan bisa dikirim ke {{email}}.',
      ],
    },
  ],
}

const termsEn: LegalDocument = {
  kicker: 'Terms',
  title: 'Terms of use',
  updated: '2026-11-06',
  sections: [
    {
      heading: null,
      paragraphs: [
        'These terms cover RhandytaVERSE, a personal publication run by Rhandyta Briantama. By reading or subscribing, you accept them.',
      ],
    },
    {
      heading: 'Content',
      paragraphs: [
        'The essays, notes, images, and other material on this site are written or commissioned by Rhandyta Briantama unless stated otherwise. You may quote short passages with attribution and a link. Do not republish substantial portions, take the archive for model training, or claim this work as your own without permission.',
      ],
    },
    {
      heading: 'The newsletter',
      paragraphs: [
        'The newsletter is a personal letter, not a news service or a promised schedule. Subscriptions require confirmation. You can leave at any time. Do not sign up with an address that is not yours.',
      ],
    },
    {
      heading: 'Fair use of the service',
      paragraphs: [
        'Do not attempt to disrupt the site, bypass access controls, scrape at a rate that slows the service, or use the contact or newsletter forms for spam, harassment, or unlawful activity.',
      ],
    },
    {
      heading: 'Third-party links',
      paragraphs: [
        'Links to other sites are provided as context. I do not control those sites and am not responsible for their content, availability, or privacy practices.',
      ],
    },
    {
      heading: 'No warranty',
      paragraphs: [
        'This publication is provided as is. I aim for accuracy, but I do not warrant that every statement is complete, current, or fit for a particular purpose. Nothing here is professional, legal, financial, or medical advice.',
      ],
    },
    {
      heading: 'Changes',
      paragraphs: [
        'I may update these terms; the “last updated” date will change. Material changes will be reflected on this page. Questions can be sent to {{email}}.',
      ],
    },
  ],
}

export const privacyDocument: Record<Locale, LegalDocument> = { id: privacyId, en: privacyEn }
export const termsDocument: Record<Locale, LegalDocument> = { id: termsId, en: termsEn }

export type AboutCopy = {
  personHeading: string
  personParagraphs: string[]
  findHeading: string
  findParagraphs: string[]
  howHeading: string
  howParagraphs: string[]
  independenceHeading: string
  independenceParagraphs: string[]
  correspondenceBody: string
  colophon: {
    editor: string
    issue: string
    sections: string
    pieces: string
    type: string
    engine: string
  }
}

const aboutId: AboutCopy = {
  personHeading: 'Orang di balik publikasi ini',
  personParagraphs: [
    '{{name}} menulis dan menyunting {{site}}. Publikasi ini bukan merek terpisah dengan suara yang terpisah; ia adalah catatan kerja satu orang, yang dirawat di depan umum.',
  ],
  findHeading: 'Apa yang akan kamu temukan di sini',
  findParagraphs: [
    'Esai dan catatan tentang teknologi, desain, sains, budaya, pekerjaan, dan urusan biasa dalam memperhatikan sesuatu. Subjeknya sengaja tidak dibatasi. Publikasi ini tidak punya satu subjek, karena seseorang juga tidak punya satu subjek.',
    'Tulisan diarsipkan menurut rubrik, ditandai tag secara longgar, dan disimpan dalam arsip kronologis yang utuh. Tidak ada yang diletakkan di balik paywall, akun, atau modal.',
  ],
  howHeading: 'Bagaimana ini dibuat',
  howParagraphs: [
    '{{site}} adalah platform penerbitan kecil yang berdiri sendiri. Halaman dirender di server, teks disimpan dalam basis data SQLite serverless, gambar diproses menjadi format modern saat diunggah, dan JavaScript sisi klien hanya mencakup beberapa interaksi: pergantian tema, kemajuan membaca, pencarian, dan menyimpan artikel untuk nanti.',
    'Huruf disajikan bersama situs ini, bukan diambil dari pihak ketiga. Tidak ada jaringan atau skrip iklan. Pengukuran pembaca internal dilakukan sendiri tanpa cookie analitik dan tanpa alamat IP mentah, sementara halaman publik memuat Google Tag Manager untuk pengukuran trafik dasar.',
  ],
  independenceHeading: 'Independensi editorial',
  independenceParagraphs: [
    '{{site}} ditulis dan disunting secara independen oleh {{name}}. Tidak ada yang terbit menurut jadwal tetap; tulisan ditambahkan ketika ada sesuatu yang layak disampaikan. Arsip disimpan utuh, dan koreksi dicatat di dalam tulisan, bukan dihapus diam-diam.',
  ],
  correspondenceBody:
    'Untuk publikasi sebesar ini, alamat yang tepat adalah surel biasa. Koreksi dicatat di dalam tulisan, bukan dihapus diam-diam. Jika ada yang keliru di sini, sampaikan.',
  colophon: {
    editor: 'Penyunting',
    issue: 'Edisi',
    sections: 'Rubrik',
    pieces: 'Tulisan',
    type: 'Tipografi',
    engine: 'Mesin',
  },
}

const aboutEn: AboutCopy = {
  personHeading: 'The person behind the publication',
  personParagraphs: [
    '{{name}} writes and edits {{site}}. The publication is not a separate brand with a separate voice; it is one person’s working record, kept in public.',
  ],
  findHeading: 'What you will find here',
  findParagraphs: [
    'Essays and notes on technology, design, science, culture, work, and the ordinary business of paying attention. The subject is deliberately unbounded. This publication has no single subject, because a person does not either.',
    'Pieces are archived by section, loosely tagged, and kept in a complete chronological archive. Nothing sits behind a paywall, an account, or a modal.',
  ],
  howHeading: 'How this is made',
  howParagraphs: [
    '{{site}} is a small, self-contained publishing platform. Pages are rendered on the server, text lives in a serverless SQLite database, images are processed into modern formats on upload, and client-side JavaScript covers only a few interactions: theme switching, reading progress, search, and saving articles for later.',
    'The typefaces ship with the site rather than being fetched from a third party. There are no advertising networks or scripts. Internal reader measurement runs without analytics cookies or raw IP addresses, while public pages load Google Tag Manager for basic traffic measurement.',
  ],
  independenceHeading: 'Editorial independence',
  independenceParagraphs: [
    '{{site}} is written and edited independently by {{name}}. Nothing is published on a fixed schedule; pieces are added when there is something worth saying. The archive is kept whole, and corrections are noted inside the piece rather than quietly removed.',
  ],
  correspondenceBody:
    'For a publication this size, the right channel is ordinary email. Corrections are noted inside the piece rather than quietly removed. If something here is wrong, say so.',
  colophon: {
    editor: 'Editor',
    issue: 'Issue',
    sections: 'Sections',
    pieces: 'Pieces',
    type: 'Typography',
    engine: 'Engine',
  },
}

export const aboutDocument: Record<Locale, AboutCopy> = { id: aboutId, en: aboutEn }
