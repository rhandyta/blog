/**
 * Shared interface strings: the vocabulary every page and both shells use.
 * `en` is typed against `id`, so a key can never exist in only one language.
 */
const id = {
  yes: 'Ya',
  no: 'Tidak',
  essay: 'Esai',
  note: 'Catatan',
  editor: 'Editor',
  editorsPick: 'Pilihan editor',
  authorFallback: 'Redaksi',
  read: 'Baca',
  remove: 'Hapus',
  back: 'Kembali',
  close: 'Tutup',
  cancel: 'Batal',
  save: 'Simpan',
  all: 'Semua',
  loading: 'Memuat…',
  dash: '—',
  minuteShort: '{{count}} menit',
  minuteShort_one: '{{count}} menit',
  pieceCount: '{{count}} tulisan',
  pieceCount_one: '{{count}} tulisan',
  yearCount: '{{count}} tahun',
  yearCount_one: '{{count}} tahun',
  sectionCount: '{{count}} rubrik',
  sectionCount_one: '{{count}} rubrik',
  language: 'Bahasa',
  siteLanguage: 'Bahasa situs',
}

const en: typeof id = {
  yes: 'Yes',
  no: 'No',
  essay: 'Essay',
  note: 'Note',
  editor: 'Editor',
  editorsPick: 'Editors’ pick',
  authorFallback: 'The desk',
  read: 'Read',
  remove: 'Remove',
  back: 'Back',
  close: 'Close',
  cancel: 'Cancel',
  save: 'Save',
  all: 'All',
  loading: 'Loading…',
  dash: '—',
  minuteShort: '{{count}} min',
  minuteShort_one: '{{count}} min',
  pieceCount: '{{count}} pieces',
  pieceCount_one: '{{count}} piece',
  yearCount: '{{count}} years',
  yearCount_one: '{{count}} year',
  sectionCount: '{{count}} sections',
  sectionCount_one: '{{count}} section',
  language: 'Language',
  siteLanguage: 'Site language',
}

export const common = { id, en }

const navId = {
  articles: 'Artikel',
  topics: 'Topik',
  archive: 'Arsip',
  about: 'Tentang',
  saved: 'Tersimpan',
  search: 'Cari',
  home: 'Beranda',
  primary: 'Navigasi utama',
  mobile: 'Navigasi seluler',
  menu: 'Menu situs',
  openMenu: 'Buka menu',
  closeMenu: 'Tutup menu',
  language: 'Pilih bahasa',
  switchTo: 'Alihkan ke {{language}}',
  current: 'Bahasa aktif: {{language}}',
  indonesian: 'Indonesia',
  english: 'English',
}

const navEn: typeof navId = {
  articles: 'Articles',
  topics: 'Topics',
  archive: 'Archive',
  about: 'About',
  saved: 'Saved',
  search: 'Search',
  home: 'Home',
  primary: 'Primary navigation',
  mobile: 'Mobile navigation',
  menu: 'Site menu',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  language: 'Choose language',
  switchTo: 'Switch to {{language}}',
  current: 'Current language: {{language}}',
  indonesian: 'Indonesian',
  english: 'English',
}

export const nav = { id: navId, en: navEn }

const headerId = {
  themeToggle: 'Ganti tema warna',
  themeToLight: 'Ganti ke tema terang',
  themeToDark: 'Ganti ke tema gelap',
  searchLabel: 'Cari di publikasi',
  savedLabel: 'Artikel tersimpan',
  skipToContent: 'Lewati ke konten',
  homeLink: '{{site}} — beranda',
}

const headerEn: typeof headerId = {
  themeToggle: 'Change colour theme',
  themeToLight: 'Switch to light theme',
  themeToDark: 'Switch to dark theme',
  searchLabel: 'Search the publication',
  savedLabel: 'Saved articles',
  skipToContent: 'Skip to content',
  homeLink: '{{site}} — home',
}

export const header = { id: headerId, en: headerEn }

const footerId = {
  sections: 'Rubrik',
  index: 'Indeks',
  elsewhere: 'Di tempat lain',
  rss: 'Umpan RSS',
  newsletter: 'Surat kabar',
  email: 'Surel',
  allArticles: 'Semua artikel',
  topics: 'Topik',
  archive: 'Arsip',
  search: 'Cari',
  saved: 'Tersimpan',
  about: 'Tentang',
  privacy: 'Privasi',
  terms: 'Ketentuan',
  editorialDesk: 'Meja editorial',
  allTopics: 'Semua topik',
  writtenBy: 'Ditulis dan disunting oleh Rhandyta Briantama',
  publishedAs: 'Diterbitkan sebagai',
  typeset: 'Disusun dengan Fraunces & Newsreader',
  newsletterKicker: 'Surat kabar',
}

const footerEn: typeof footerId = {
  sections: 'Sections',
  index: 'Index',
  elsewhere: 'Elsewhere',
  rss: 'RSS feed',
  newsletter: 'Newsletter',
  email: 'Email',
  allArticles: 'All articles',
  topics: 'Topics',
  archive: 'Archive',
  search: 'Search',
  saved: 'Saved',
  about: 'About',
  privacy: 'Privacy',
  terms: 'Terms',
  editorialDesk: 'Editorial desk',
  allTopics: 'All topics',
  writtenBy: 'Written and edited by Rhandyta Briantama',
  publishedAs: 'Published as',
  typeset: 'Set in Fraunces & Newsreader',
  newsletterKicker: 'Newsletter',
}

export const footer = { id: footerId, en: footerEn }

const errorsId = {
  notFoundKicker: 'Tersesat, bukan terlupakan',
  notFoundTitle: 'Halaman ini tidak ada di indeks.',
  notFoundBody:
    'Alamatnya mungkin sudah berubah, atau tulisan itu memang tidak pernah ada. Arsip adalah tempat yang baik untuk mulai mencari.',
  serverKicker: 'Ada yang tidak berjalan',
  serverTitle: 'Mesin cetak berhenti sejenak.',
  serverBody: 'Terjadi kesalahan tak terduga saat merender halaman ini. Kesalahan sudah dicatat; silakan coba lagi.',
  reference: 'Referensi: {{id}}',
  backHome: 'Kembali ke beranda',
  goToArchive: 'Jelajahi arsip',
  unexpected: 'Terjadi kesalahan tak terduga.',
  notFoundDescription: 'Alamat yang kamu minta tidak ada di indeks.',
  serverDescription: 'Terjadi kesalahan tak terduga.',
}

const errorsEn: typeof errorsId = {
  notFoundKicker: 'Misplaced, not forgotten',
  notFoundTitle: 'This page is not in the index.',
  notFoundBody:
    'The address may have changed, or the piece never existed. The archive is a good place to start looking.',
  serverKicker: 'Something came loose',
  serverTitle: 'The press stopped for a moment.',
  serverBody: 'An unexpected error occurred while rendering this page. It has been logged; please try again.',
  reference: 'Reference: {{id}}',
  backHome: 'Back to the homepage',
  goToArchive: 'Browse the archive',
  unexpected: 'An unexpected error occurred.',
  notFoundDescription: 'The address you asked for is not in the index.',
  serverDescription: 'An unexpected error occurred.',
}

export const errors = { id: errorsId, en: errorsEn }
