// Fixed set of pocket chip colours. Values live in styles.css as --pocket-<name>; each reads on the board and the ground.
export const pocketColors = ['graphite', 'blue', 'orange', 'green', 'purple', 'pink', 'teal'] as const

export type PocketColor = (typeof pocketColors)[number]

export const pocketBg = (color: string) => `var(--pocket-${pocketColors.includes(color as PocketColor) ? color : 'graphite'})`

/**
 * A card's security print: fine wavy lines as an SVG path in a 240×40 box, each pocket's own from its id
 * (the same lines on every visit and on the server).
 */
export function securityPrint(seed: string) {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  // mulberry32: small, seedable, good enough for a pattern.
  const rand = () => {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const f = 1 + rand() * 2
  const g = 3 + rand() * 3
  const phase = rand() * Math.PI * 2
  const step = 0.25 + rand() * 0.35
  let d = ''
  for (let i = 0; i < 9; i++) {
    for (let x = 0; x <= 240; x += 4) {
      const t = (x / 240) * Math.PI * 2
      // Centred in the strip that shows above the pocket.
      const y = 12 + 6 * Math.sin(f * t + phase + i * step) + 2.5 * Math.sin(g * t - i * step)
      d += `${x ? 'L' : 'M'}${x} ${y.toFixed(1)}`
    }
  }
  return d
}
