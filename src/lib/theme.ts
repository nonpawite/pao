export const themes = ['system', 'light', 'dark'] as const
export type Theme = (typeof themes)[number]

/** The colour mode in a cookie: anything but Light or Dark follows the system, since the browser sends it. */
export const parseTheme = (value: string | null | undefined): Theme => (themes as readonly string[]).includes(value ?? '') ? (value as Theme) : 'system'

/** The browser's status-bar colour for each appearance: the page colour, light and dark. */
export const themeColor = { light: '#fafaf9', dark: '#0d0d0e' } as const
