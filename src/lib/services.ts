// Known subscription services, ported from Subly. Picking one pre-fills a new bill's name, repeat and,
// when the pocket's currency matches, a plan's price. No logos and no network calls (ADR 0004).
// Amounts here are whole units (99 = ฿99); prefill turns them into hundredths.

type Unit = 'day' | 'week' | 'month' | 'year' | 'once'

export type Service = {
  name: string
  // Kept from Subly's list; unused for now.
  domain: string
  cat: string
  aliases?: string[]
  cycle?: Unit
  amount?: number
  currency?: string
  plans?: Plan[]
}

export type Plan = {
  name: string
  amount: number
  currency: string
  cycle: Unit
}

// ponytail: hand-kept list, no live fetch (no public price APIs; pages are geo/JS-gated).
// THB = regular (non-promo) Thailand prices; USD = list price where Thai users are billed in USD.
// Checked 2026-10-21. No plans = no reliable regular price (carrier bundles, usage-based, per-user quotes).
const plans = (currency: string, ...rows: [name: string, amount: number, cycle?: Unit][]): Plan[] =>
  rows.map(([name, amount, cycle = 'month']) => ({
    name,
    amount,
    currency,
    cycle,
  }))

const m = (name: string, domain: string, cat: string, extra: Partial<Service> = {}): Service => ({
  name,
  domain,
  cat,
  ...extra,
})

// Known services: picking one pre-fills website, category and (sometimes) cycle/price.
export const SERVICES: Service[] = [
  // Streaming
  m('Netflix', 'netflix.com', 'video', {
    aliases: ['เน็ตฟลิกซ์'],
    plans: plans('THB', ['Mobile', 99], ['Basic', 169], ['Standard', 349], ['Premium', 419]),
  }),
  m('YouTube Premium', 'youtube.com', 'video', {
    aliases: ['youtube', 'ยูทูป'],
    plans: plans('THB', ['Lite', 119], ['Individual', 199], ['Family', 399], ['Individual (annual)', 1990, 'year']),
  }),
  m('Disney+ Hotstar', 'disneyplus.com', 'video', {
    aliases: ['disney'],
    plans: plans('THB', ['Standard', 199], ['Premium', 289], ['Standard (annual)', 1590, 'year'], ['Premium (annual)', 2290, 'year']),
  }),
  m('HBO Max', 'max.com', 'video', {
    aliases: ['max', 'hbo'],
    plans: plans(
      'THB',
      ['Mobile', 149],
      ['Standard', 199],
      ['Ultimate', 299],
      ['Mobile (annual)', 890, 'year'],
      ['Standard (annual)', 1390, 'year'],
      ['Ultimate (annual)', 2090, 'year'],
    ),
  }),
  m('Prime Video', 'primevideo.com', 'video', {
    aliases: ['amazon prime video'],
    plans: plans('THB', ['Monthly', 149]),
  }),
  m('Apple TV+', 'tv.apple.com', 'video', {
    aliases: ['apple tv'],
    plans: plans('THB', ['Monthly', 249]),
  }),
  m('Viu', 'viu.com', 'video', { plans: plans('THB', ['Premium', 149]) }),
  m('iQIYI', 'iq.com', 'video'),
  m('WeTV', 'wetv.vip', 'video', { plans: plans('THB', ['VIP', 129]) }),
  m('TrueID', 'trueid.net', 'video', { aliases: ['true id', 'ทรูไอดี'] }),
  m('AIS PLAY', 'aisplay.ais.co.th', 'video'),
  m('MONOMAX', 'monomax.me', 'video', { aliases: ['mono max'] }),
  m('CH3 Plus', 'ch3plus.com', 'video', { aliases: ['ช่อง 3'] }),
  m('Crunchyroll', 'crunchyroll.com', 'video'),
  m('Bilibili', 'bilibili.tv', 'video'),
  m('Twitch', 'twitch.tv', 'video'),
  // Music
  m('Spotify', 'spotify.com', 'music', {
    plans: plans('THB', ['Student', 79], ['Individual', 149], ['Duo', 209], ['Family', 249]),
  }),
  m('Apple Music', 'music.apple.com', 'music', {
    plans: plans('THB', ['Student', 79], ['Individual', 149], ['Family', 249]),
  }),
  m('YouTube Music', 'music.youtube.com', 'music'),
  m('JOOX', 'joox.com', 'music'),
  m('TIDAL', 'tidal.com', 'music'),
  m('Deezer', 'deezer.com', 'music'),
  m('SoundCloud', 'soundcloud.com', 'music'),
  m('Audible', 'audible.com', 'reading', {
    plans: plans('USD', ['Standard', 8.99], ['Premium Plus', 14.95]),
  }),
  // AI
  m('ChatGPT', 'chatgpt.com', 'ai', {
    aliases: ['openai', 'chat gpt'],
    plans: plans('USD', ['Plus', 20], ['Business', 30], ['Pro', 200]),
  }),
  m('Claude', 'claude.ai', 'ai', {
    aliases: ['anthropic'],
    plans: plans('USD', ['Pro', 20], ['Max 5x', 100], ['Max 20x', 200]),
  }),
  m('Gemini', 'gemini.google.com', 'ai', {
    aliases: ['google ai', 'google ai pro'],
    plans: plans('THB', ['Google AI Pro', 749]),
  }),
  m('Perplexity', 'perplexity.ai', 'ai', {
    plans: plans('USD', ['Pro', 20], ['Pro (annual)', 200, 'year'], ['Max', 200]),
  }),
  m('Midjourney', 'midjourney.com', 'ai', {
    plans: plans('USD', ['Basic', 10], ['Standard', 30], ['Pro', 60], ['Mega', 120]),
  }),
  m('Cursor', 'cursor.com', 'ai', {
    plans: plans('USD', ['Pro', 20], ['Pro+', 60], ['Ultra', 200]),
  }),
  m('GitHub Copilot', 'github.com', 'ai', {
    aliases: ['copilot'],
    plans: plans('USD', ['Pro', 10], ['Pro+', 39], ['Max', 100]),
  }),
  m('Grammarly', 'grammarly.com', 'ai', {
    plans: plans('USD', ['Pro', 30], ['Pro (annual)', 144, 'year']),
  }),
  m('Grok', 'grok.com', 'ai', {
    aliases: ['supergrok', 'xai'],
    plans: plans('USD', ['SuperGrok', 30], ['SuperGrok Heavy', 300]),
  }),
  m('ElevenLabs', 'elevenlabs.io', 'ai', {
    plans: plans('USD', ['Starter', 5], ['Creator', 22], ['Pro', 99]),
  }),
  m('Suno', 'suno.com', 'ai', {
    plans: plans('USD', ['Pro', 10], ['Premier', 30]),
  }),
  m('Runway', 'runwayml.com', 'ai', {
    plans: plans('USD', ['Standard', 15], ['Pro', 35], ['Unlimited', 95]),
  }),
  // Work & apps
  m('Microsoft 365', 'microsoft.com', 'work', {
    aliases: ['office 365', 'office'],
  }),
  m('Google Workspace', 'workspace.google.com', 'work'),
  m('Notion', 'notion.so', 'work', {
    plans: plans('USD', ['Plus', 12], ['Business', 24]),
  }),
  m('Canva', 'canva.com', 'work', { plans: plans('THB', ['Pro', 230]) }),
  m('CapCut', 'capcut.com', 'work', {
    aliases: ['capcut pro', 'แคปคัท'],
    plans: plans('THB', ['Pro', 498], ['Pro (annual)', 3520, 'year'], ['Standard (annual)', 1760, 'year']),
  }),
  m('Adobe Creative Cloud', 'adobe.com', 'work', {
    aliases: ['adobe', 'photoshop', 'lightroom'],
  }),
  m('Figma', 'figma.com', 'work', {
    plans: plans('USD', ['Professional', 20]),
  }),
  m('Slack', 'slack.com', 'work', {
    plans: plans('USD', ['Pro', 8.75], ['Business+', 18]),
  }),
  m('Zoom', 'zoom.us', 'work'),
  m('Todoist', 'todoist.com', 'work', {
    plans: plans('USD', ['Pro', 5], ['Business', 8]),
  }),
  m('Linear', 'linear.app', 'work', {
    plans: plans('USD', ['Basic', 10], ['Business', 16]),
  }),
  m('Raycast', 'raycast.com', 'work', { plans: plans('USD', ['Pro', 10]) }),
  m('Setapp', 'setapp.com', 'work', {
    plans: plans('USD', ['Mac', 9.99], ['Mac + iOS', 12.49]),
  }),
  m('Obsidian', 'obsidian.md', 'work', {
    aliases: ['obsidian sync'],
    plans: plans('USD', ['Sync Standard', 5], ['Sync Plus', 10]),
  }),
  m('Coursera Plus', 'coursera.org', 'work', {
    aliases: ['coursera'],
    plans: plans('USD', ['Monthly', 59], ['Annual', 399, 'year']),
  }),
  m('LinkedIn Premium', 'linkedin.com', 'work', { aliases: ['linkedin'] }),
  m('1Password', '1password.com', 'work', {
    plans: plans('USD', ['Individual', 35.88, 'year'], ['Families', 59.88, 'year']),
  }),
  m('Bitwarden', 'bitwarden.com', 'work'),
  m('NordVPN', 'nordvpn.com', 'work', { aliases: ['vpn'] }),
  m('ExpressVPN', 'expressvpn.com', 'work'),
  m('Surfshark', 'surfshark.com', 'work'),
  m('Duolingo', 'duolingo.com', 'work'),
  m('LINE', 'line.me', 'other', { aliases: ['line sticker', 'ไลน์'] }),
  m('Grab Unlimited', 'grab.com', 'other', { aliases: ['grab'] }),
  m('LINE MAN', 'lineman.line.me', 'other'),
  m('foodpanda pandapro', 'foodpanda.co.th', 'other', {
    aliases: ['foodpanda', 'pandapro'],
  }),
  m('Amazon Prime', 'amazon.com', 'other', {
    plans: plans('USD', ['Monthly', 14.99], ['Annual', 139, 'year']),
  }),
  m('Patreon', 'patreon.com', 'other'),
  m('X Premium', 'x.com', 'other', { aliases: ['twitter'] }),
  m('Telegram Premium', 'telegram.org', 'other', { aliases: ['telegram'] }),
  m('Tinder', 'tinder.com', 'other'),
  // Cloud & storage
  m('iCloud+', 'icloud.com', 'cloud', {
    aliases: ['icloud'],
    plans: plans('THB', ['50 GB', 35], ['200 GB', 99], ['2 TB', 399], ['6 TB', 1190], ['12 TB', 2390]),
  }),
  m('Google One', 'one.google.com', 'cloud', { aliases: ['google drive'] }),
  m('Dropbox', 'dropbox.com', 'cloud', {
    plans: plans('USD', ['Plus', 11.99], ['Essentials', 22]),
  }),
  m('Proton', 'proton.me', 'cloud', {
    aliases: ['proton mail', 'protonmail'],
    plans: plans('USD', ['Mail Plus', 4.99], ['Unlimited', 12.99]),
  }),
  m('Apple One', 'apple.com', 'cloud', {
    plans: plans('THB', ['Individual', 369], ['Family', 449]),
  }),
  // Dev & hosting
  m('GitHub', 'github.com', 'dev', { plans: plans('USD', ['Pro', 4]) }),
  m('Vercel', 'vercel.com', 'dev', { plans: plans('USD', ['Pro', 20]) }),
  m('Netlify', 'netlify.com', 'dev', {
    plans: plans('USD', ['Personal', 9], ['Pro', 20]),
  }),
  m('Neon', 'neon.tech', 'dev'),
  m('Supabase', 'supabase.com', 'dev', { plans: plans('USD', ['Pro', 25]) }),
  m('Cloudflare', 'cloudflare.com', 'dev', {
    plans: plans('USD', ['Pro', 25], ['Business', 250]),
  }),
  m('AWS', 'aws.amazon.com', 'dev', { aliases: ['amazon web services'] }),
  m('DigitalOcean', 'digitalocean.com', 'dev'),
  m('Railway', 'railway.app', 'dev', {
    plans: plans('USD', ['Hobby', 5], ['Pro', 20]),
  }),
  m('Namecheap', 'namecheap.com', 'dev', { cycle: 'year' }),
  m('GoDaddy', 'godaddy.com', 'dev', { cycle: 'year' }),
  m('JetBrains', 'jetbrains.com', 'dev', {
    plans: plans('USD', ['IntelliJ IDEA Ultimate', 16.9], ['All Products Pack', 28.9]),
  }),
  // Gaming
  m('Xbox Game Pass', 'xbox.com', 'gaming', {
    aliases: ['game pass'],
    plans: plans('USD', ['Essential', 9.99], ['Premium', 14.99], ['PC Game Pass', 16.49], ['Ultimate', 29.99]),
  }),
  m('PlayStation Plus', 'playstation.com', 'gaming', {
    aliases: ['ps plus', 'psn'],
  }),
  m('Nintendo Switch Online', 'nintendo.com', 'gaming', {
    plans: plans('USD', ['Individual', 19.99, 'year'], ['Family', 34.99, 'year'], ['+ Expansion Pack', 49.99, 'year']),
  }),
  m('Apple Arcade', 'apple.com', 'gaming', {
    plans: plans('THB', ['Monthly', 149], ['Annual', 989, 'year']),
  }),
  m('Discord Nitro', 'discord.com', 'gaming', { aliases: ['discord'] }),
  m('EA Play', 'ea.com', 'gaming', {
    plans: plans('USD', ['Monthly', 5.99], ['Annual', 39.99, 'year']),
  }),
  m('Roblox Premium', 'roblox.com', 'gaming', {
    aliases: ['roblox'],
    plans: plans('USD', ['450 Robux', 4.99], ['1,000 Robux', 9.99], ['2,200 Robux', 19.99]),
  }),
  // Reading
  m('Medium', 'medium.com', 'reading', {
    plans: plans('USD', ['Member', 5], ['Member (annual)', 50, 'year'], ['Friend', 15]),
  }),
  m('Kindle Unlimited', 'amazon.com', 'reading', {
    aliases: ['kindle'],
    plans: plans('USD', ['Monthly', 11.99]),
  }),
  m('The New York Times', 'nytimes.com', 'reading', { aliases: ['nyt'] }),
  m('The Economist', 'economist.com', 'reading'),
  m('MEB', 'mebmarket.com', 'reading', { aliases: ['meb market'] }),
  m('ReadAWrite', 'readawrite.com', 'reading'),
  m('Ookbee', 'ookbee.com', 'reading'),
  // Fitness
  m('Strava', 'strava.com', 'fitness'),
  m('Apple Fitness+', 'apple.com', 'fitness'),
  m('Headspace', 'headspace.com', 'fitness', {
    plans: plans('USD', ['Monthly', 12.99], ['Annual', 69.99, 'year']),
  }),
  m('Calm', 'calm.com', 'fitness', {
    plans: plans('USD', ['Monthly', 14.99], ['Annual', 69.99, 'year']),
  }),
  m('Fitness First', 'fitnessfirst.co.th', 'fitness'),
  m('Jetts Fitness', 'jetts.co.th', 'fitness', { aliases: ['jetts'] }),
  m('Virgin Active', 'virginactive.co.th', 'fitness'),
  // Phone & internet
  m('AIS', 'ais.th', 'telecom', { aliases: ['เอไอเอส', 'ais fibre'] }),
  m('True', 'true.th', 'telecom', {
    aliases: ['ทรู', 'true move', 'true online'],
  }),
  m('dtac', 'dtac.co.th', 'telecom', { aliases: ['ดีแทค'] }),
  m('3BB', '3bb.co.th', 'telecom'),
  m('NT', 'ntplc.co.th', 'telecom', {
    aliases: ['ทีโอที', 'cat', 'national telecom'],
  }),
  // Bills
  m('MEA electricity', 'mea.or.th', 'bills', {
    aliases: ['การไฟฟ้านครหลวง', 'กฟน', 'ค่าไฟ'],
  }),
  m('PEA electricity', 'pea.co.th', 'bills', {
    aliases: ['การไฟฟ้าส่วนภูมิภาค', 'กฟภ'],
  }),
  m('MWA water', 'mwa.co.th', 'bills', {
    aliases: ['การประปานครหลวง', 'กปน', 'ค่าน้ำ'],
  }),
  m('PWA water', 'pwa.co.th', 'bills', {
    aliases: ['การประปาส่วนภูมิภาค', 'กปภ'],
  }),
  // Insurance (usually yearly)
  m('AIA', 'aia.co.th', 'insurance', { cycle: 'year', aliases: ['เอไอเอ'] }),
  m('Muang Thai Life', 'muangthai.co.th', 'insurance', {
    cycle: 'year',
    aliases: ['เมืองไทยประกันชีวิต'],
  }),
  m('Thai Life', 'thailife.com', 'insurance', {
    cycle: 'year',
    aliases: ['ไทยประกันชีวิต'],
  }),
  m('Allianz Ayudhya', 'azay.co.th', 'insurance', {
    cycle: 'year',
    aliases: ['อลิอันซ์ อยุธยา'],
  }),
  m('Bangkok Life', 'bangkoklife.com', 'insurance', {
    cycle: 'year',
    aliases: ['กรุงเทพประกันชีวิต'],
  }),
  m('Krungthai-AXA', 'krungthai-axa.co.th', 'insurance', {
    cycle: 'year',
    aliases: ['กรุงไทย แอกซ่า'],
  }),
  m('FWD', 'fwd.co.th', 'insurance', { cycle: 'year' }),
  m('Dhipaya', 'dhipaya.co.th', 'insurance', {
    cycle: 'year',
    aliases: ['ทิพยประกันภัย'],
  }),
  m('Viriyah', 'viriyah.co.th', 'insurance', {
    cycle: 'year',
    aliases: ['วิริยะประกันภัย'],
  }),
  // Funds & loans (fixed government rates)
  m('Social Security · Section 39', 'sso.go.th', 'finance', {
    amount: 432,
    currency: 'THB',
    aliases: ['ประกันสังคม มาตรา 39', 'ม.39', 'ประกันสังคม'],
  }),
  m('Social Security · Section 40 (1)', 'sso.go.th', 'finance', {
    amount: 70,
    currency: 'THB',
    aliases: ['ประกันสังคม มาตรา 40', 'ม.40'],
  }),
  m('Social Security · Section 40 (2)', 'sso.go.th', 'finance', {
    amount: 100,
    currency: 'THB',
  }),
  m('Social Security · Section 40 (3)', 'sso.go.th', 'finance', {
    amount: 300,
    currency: 'THB',
  }),
  m('Student Loan Fund (กยศ.)', 'studentloan.or.th', 'finance', {
    cycle: 'year',
    currency: 'THB',
    aliases: ['กยศ', 'กองทุนเงินให้กู้ยืมเพื่อการศึกษา'],
  }),
]

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9฀-๿]+/g, '')

/** Best catalog matches for what the user typed (prefix matches first). */
export function searchServices(q: string, limit = 6): Service[] {
  const n = norm(q)
  if (n.length < 2) return []
  const score = (c: Service) => {
    const names = [c.name, ...(c.aliases ?? [])].map(norm)
    if (names.some((x) => x === n)) return 0
    if (names.some((x) => x.startsWith(n))) return 1
    if (names.some((x) => x.includes(n))) return 2
    return 9
  }
  return SERVICES.map((c) => [score(c), c] as const)
    .filter(([s]) => s < 9)
    .sort((a, b) => a[0] - b[0])
    .slice(0, limit)
    .map(([, c]) => c)
}

export type Prefill = {
  name: string
  unit: 'week' | 'month' | 'year'
  plans: { name: string; amount: number; unit: 'week' | 'month' | 'year' }[]
}

const billUnit = (u: Unit | undefined) => (u === 'week' || u === 'year' ? u : 'month')

/** What picking a service fills in: its name, its repeat, and the plans priced in the pocket's currency. */
export function prefill(s: Service, currency: string): Prefill {
  const plans =
    s.plans ??
    (s.amount !== undefined && s.currency ? [{ name: s.name, amount: s.amount, currency: s.currency, cycle: s.cycle ?? 'month' }] : [])
  return {
    name: s.name,
    unit: billUnit(s.plans?.[0]?.cycle ?? s.cycle),
    plans: plans
      .filter((p) => p.currency === currency && p.cycle !== 'once' && p.cycle !== 'day')
      .map((p) => ({ name: p.name, amount: Math.round(p.amount * 100), unit: billUnit(p.cycle) })),
  }
}
