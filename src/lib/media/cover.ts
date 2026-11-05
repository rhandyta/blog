const PAPER = '#f2ede2'
const PAPER_DEEP = '#e6ddca'
const INK = '#17140f'

function mulberry32(seed: number) {
  let state = seed >>> 0
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (value: number) => Math.round(value * 10) / 10

/**
 * Deterministic abstract cover art for seeded articles.
 * Geometric only — no text, no external assets, no font dependencies.
 */
export function coverSvg(seed: number, accent: string): string {
  const random = mulberry32(seed * 7919 + 17)
  const composition = seed % 5
  const drift = Math.round(random() * 60 - 30)
  const parts: string[] = []

  if (composition === 0) {
    parts.push(`<rect width="1600" height="1000" fill="${PAPER}"/>`)
    for (let index = 0; index < 11; index += 1) {
      const y = 160 + index * 68
      parts.push(
        `<line x1="170" y1="${y}" x2="${780 + (index % 3) * 40}" y2="${y}" stroke="${INK}" stroke-width="1" opacity="${index % 2 === 0 ? 0.55 : 0.3}"/>`,
      )
    }
    parts.push(`<rect x="112" y="150" width="16" height="710" fill="${INK}"/>`)
    parts.push(`<circle cx="${1170 + drift}" cy="400" r="270" fill="${accent}"/>`)
    parts.push(`<circle cx="${1170 + drift}" cy="400" r="270" fill="none" stroke="${INK}" stroke-width="1.5" opacity="0.35"/>`)
    parts.push(`<rect x="210" y="700" width="52" height="52" fill="${accent}"/>`)
    parts.push(`<rect x="1520" y="820" width="40" height="40" fill="${INK}"/>`)
  }

  if (composition === 1) {
    parts.push(`<rect width="1600" height="1000" fill="${INK}"/>`)
    for (let index = 0; index < 7; index += 1) {
      const y = 140 + index * 118
      parts.push(`<line x1="90" y1="${y}" x2="1510" y2="${y}" stroke="${PAPER}" stroke-width="1" opacity="0.35"/>`)
    }
    parts.push(`<rect x="${1000 + drift}" y="0" width="190" height="1000" fill="${accent}"/>`)
    parts.push(`<circle cx="420" cy="520" r="300" fill="none" stroke="${PAPER}" stroke-width="2"/>`)
    parts.push(`<circle cx="420" cy="520" r="186" fill="none" stroke="${PAPER}" stroke-width="1" opacity="0.5"/>`)
    parts.push(`<rect x="1300" y="760" width="130" height="130" fill="none" stroke="${PAPER}" stroke-width="2"/>`)
  }

  if (composition === 2) {
    parts.push(`<rect width="1600" height="1000" fill="${PAPER}"/>`)
    parts.push(`<rect x="110" y="150" width="1380" height="190" fill="${INK}"/>`)
    parts.push(`<rect x="${330 + drift}" y="410" width="1160" height="120" fill="${accent}"/>`)
    parts.push(`<rect x="110" y="620" width="760" height="230" fill="${PAPER_DEEP}" stroke="${INK}" stroke-width="1.5"/>`)
    parts.push(`<line x1="930" y1="120" x2="930" y2="890" stroke="${INK}" stroke-width="1" opacity="0.55"/>`)
    parts.push(`<circle cx="1300" cy="760" r="74" fill="${accent}"/>`)
  }

  if (composition === 3) {
    parts.push(`<rect width="1600" height="1000" fill="${PAPER}"/>`)
    parts.push(`<circle cx="1120" cy="260" r="110" fill="${accent}"/>`)
    parts.push(`<circle cx="1120" cy="260" r="110" fill="none" stroke="${INK}" stroke-width="1.5"/>`)
    for (let index = 0; index < 5; index += 1) {
      const radius = 260 + index * 96
      parts.push(
        `<path d="M ${1600 - radius} 1000 A ${radius} ${radius} 0 0 1 1600 ${1000 - radius}" fill="none" stroke="${INK}" stroke-width="${index === 0 ? 2 : 1}" opacity="${0.7 - index * 0.1}"/>`,
      )
    }
    for (let row = 0; row < 5; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        parts.push(`<circle cx="${150 + column * 46}" cy="${560 + row * 46}" r="2.5" fill="${INK}" opacity="0.6"/>`)
      }
    }
    parts.push(`<rect x="150" y="180" width="70" height="230" fill="${INK}"/>`)
  }

  if (composition === 4) {
    parts.push(`<rect width="1600" height="1000" fill="${PAPER}"/>`)
    const x0 = 110
    const y0 = 130
    const width = 1380
    const height = 740
    for (let x = x0; x <= x0 + width; x += 38) {
      for (let y = y0; y <= y0 + height; y += 38) {
        parts.push(`<circle cx="${x}" cy="${y}" r="1.6" fill="${INK}" opacity="0.35"/>`)
      }
    }
    parts.push(`<rect x="${x0}" y="${y0}" width="500" height="${height}" fill="${accent}"/>`)
    parts.push(`<rect x="${420 + drift}" y="300" width="720" height="420" fill="${PAPER_DEEP}" stroke="${INK}" stroke-width="2"/>`)
    parts.push(`<rect x="${980 + drift}" y="620" width="300" height="100" fill="${INK}"/>`)
    parts.push(`<circle cx="${1440}" cy="${y0 + 60}" r="26" fill="${INK}"/>`)
  }

  parts.push(`<rect x="34" y="34" width="1532" height="932" fill="none" stroke="${INK}" stroke-width="1" opacity="0.18"/>`)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" role="img">${parts.join('')}</svg>`
}

export function coverAlt(seed: number): string {
  const labels = [
    'Abstract editorial cover in warm paper tones with a solid vermilion disc and fine ruled lines',
    'Abstract editorial cover with pale rules crossing a dark field and a tall colour block',
    'Abstract editorial cover composed of stacked horizontal blocks in ink, paper, and accent colour',
    'Abstract editorial cover with concentric arcs and a dotted field',
    'Abstract editorial cover with a dotted grid, a colour field, and an outlined rectangle',
  ]
  return labels[seed % labels.length]
}

export { PAPER, INK, PAPER_DEEP }
