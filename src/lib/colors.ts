// Fixed set of pocket chip colours. Values live in styles.css as --pocket-<name>; each reads on the board and the ground.
export const pocketColors = ['graphite', 'blue', 'orange', 'green', 'purple', 'pink', 'teal'] as const

export type PocketColor = (typeof pocketColors)[number]

export const pocketBg = (color: string) => `var(--pocket-${pocketColors.includes(color as PocketColor) ? color : 'graphite'})`
