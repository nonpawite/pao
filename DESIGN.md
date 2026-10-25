---
name: Pao
description: A quiet ledger for daily and cycle spending, where the app recedes so the figures read.
colors:
  ground: "#fafaf9"
  board: "#ffffff"
  plate: "#f2f2f0"
  ink: "#111213"
  ink-2: "#6a6c70"
  ink-3: "#a3a5a8"
  rule: "#e8e8e5"
  rule-strong: "#d9d9d5"
  pocket-accent: "#14b8c4"
  ok: "#1f9a62"
  ahead: "#c98a12"
  over: "#d63b3b"
  ok-text: "#17784b"
  ahead-text: "#8f5a06"
  over-text: "#c42b2e"
  mark: "#8a8b86"
  series: "#3a3c40"
  series-hi: "#9a9ca0"
  chart-muted: "#9a9ca0"
  cat-1: "#3986e4"
  cat-2: "#ca488f"
  cat-3: "#da7134"
  cat-4: "#8d67d2"
  cat-5: "#11a6a2"
  cat-6: "#984f9c"
  cat-7: "#2f9ecf"
  cat-other: "#6b6d72"
  pocket-graphite: "#8e9095"
  pocket-blue: "#3d7bff"
  pocket-orange: "#ff7a2f"
  pocket-green: "#20b26b"
  pocket-purple: "#9466ff"
  pocket-pink: "#f0458c"
  pocket-teal: "#14b8c4"
typography:
  title:
    fontFamily: "Geist Figures, IBM Plex Sans Thai, Anuphan Variable, -apple-system, Sukhumvit Set, Segoe UI, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "-0.01em"
  hero-figure:
    fontFamily: "Geist, IBM Plex Sans Thai, Anuphan Variable, sans-serif"
    fontSize: "46px"
    fontWeight: 500
    lineHeight: 1
    fontFeature: "tnum"
  figure:
    fontFamily: "Geist, IBM Plex Sans Thai, Anuphan Variable, sans-serif"
    fontSize: "32px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  row-figure:
    fontFamily: "Geist, IBM Plex Sans Thai, Anuphan Variable, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    fontFeature: "tnum"
  body:
    fontFamily: "Geist Figures, IBM Plex Sans Thai, Anuphan Variable, -apple-system, Sukhumvit Set, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  row-name:
    fontFamily: "Geist Figures, IBM Plex Sans Thai, Anuphan Variable, -apple-system, Sukhumvit Set, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 500
  label:
    fontFamily: "Geist Figures, IBM Plex Sans Thai, Anuphan Variable, -apple-system, Sukhumvit Set, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    letterSpacing: "0"
  small:
    fontFamily: "Geist Figures, IBM Plex Sans Thai, Anuphan Variable, -apple-system, Sukhumvit Set, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  micro:
    fontFamily: "Geist Figures, IBM Plex Sans Thai, Anuphan Variable, -apple-system, Sukhumvit Set, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 500
  button:
    fontFamily: "Geist Figures, IBM Plex Sans Thai, Anuphan Variable, -apple-system, Sukhumvit Set, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 500
  dialog-title:
    fontFamily: "Geist Figures, IBM Plex Sans Thai, Anuphan Variable, -apple-system, Sukhumvit Set, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 600
  keypad-figure:
    fontFamily: "Geist, IBM Plex Sans Thai, Anuphan Variable, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    fontFeature: "tnum"
  figure-small:
    fontFamily: "Geist, IBM Plex Sans Thai, Anuphan Variable, sans-serif"
    fontSize: "30px"
    fontWeight: 500
    fontFeature: "tnum"
  typed-figure:
    fontFamily: "Geist, IBM Plex Sans Thai, Anuphan Variable, sans-serif"
    fontSize: "34px"
    fontWeight: 500
    fontFeature: "tnum"
  figure-large:
    fontFamily: "Geist, IBM Plex Sans Thai, Anuphan Variable, sans-serif"
    fontSize: "40px"
    fontWeight: 500
    fontFeature: "tnum"
  cycle-hero:
    fontFamily: "Geist, IBM Plex Sans Thai, Anuphan Variable, sans-serif"
    fontSize: "56px"
    fontWeight: 500
    fontFeature: "tnum"
  hero-figure-desktop:
    fontFamily: "Geist, IBM Plex Sans Thai, Anuphan Variable, sans-serif"
    fontSize: "64px"
    fontWeight: 500
    fontFeature: "tnum"
rounded:
  mark: "2px"
  tile: "3px"
  control: "6px"
  panel: "8px"
  full: "9999px"
spacing:
  hairline-gap: "3px"
  xs: "4px"
  sm: "8px"
  row: "12px"
  md: "16px"
  lg: "20px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 20px"
    typography: "{typography.label}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 20px"
  button-outline-hover:
    backgroundColor: "{colors.plate}"
  button-secondary:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 20px"
  button-secondary-hover:
    backgroundColor: "{colors.rule}"
  input:
    backgroundColor: "{colors.board}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "4px 14px"
  panel:
    backgroundColor: "{colors.board}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "16px"
  segmented-track:
    backgroundColor: "{colors.plate}"
    rounded: "{rounded.control}"
    padding: "2px"
  segmented-thumb:
    backgroundColor: "{colors.board}"
    textColor: "{colors.ink}"
    rounded: "5px"
    padding: "6px 12px"
  pocket-tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  pocket-tab-active:
    textColor: "{colors.ink}"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  keypad-key:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "48px"
    typography: "{typography.row-figure}"
  flap-tile:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tile}"
    typography: "{typography.hero-figure}"
---

# Design System: Pao

## Overview

**Creative North Star: "The Quiet Ledger"**

The app recedes so the figures read. White panels sit on a soft, barely warm page, separated by single hairlines rather than shadows or fills. Words are set in Anuphan for Latin and IBM Plex Sans Thai for Thai, always in sentence case; every amount, date number and count is set in Geist with tabular digits so columns of money line up. Nothing is decorated: ink carries every action, and colour appears only where it means something.

Meaning-colour comes in three fixed vocabularies. State (on pace, ahead, over) is green, amber and red, worn as dots, text and bars. Category identity is a fixed slot colour per category, used on charts and entry-tape dots. The one accent is the active pocket's own colour, set at runtime on the root, and it is used only as a mark: today's cell, the active phone tab's underline, the bills calendar's today badge and payday line, the chart's current point, and text selection. Switch pocket and the accent changes with it.

The signature is the split-flap figure: light plate tiles, one per character, split by a hairline across the middle, that flip in digit by digit when the value changes. It belongs to exactly two places, Today's hero figure (and its preview on Setup) and the amount being typed. Motion grammar is "figures flip, nothing else moves," with a short crossfade when the pocket switches. Dark mode follows the system appearance with the same roles, unless the member picks Light or Dark.

**Key Characteristics:**
- Soft page (#FAFAF9), white panels, 1px hairlines, flat at rest.
- Anuphan (Latin) and IBM Plex Sans Thai (Thai) for words in sentence case; Geist 500/600 with tabular digits for figures.
- Ink (#111213) for text and every primary action; no coloured buttons.
- One runtime accent, the active pocket's colour, used only as small marks.
- State colours as dots, text and thin bars; on-pace bars stay neutral.
- Split-flap tiles only for Today's hero (and its Setup preview) and the amount being typed.
- Small, even corners: 6px controls, 8px panels, 3px tiles, 2px marks.

## Colors

A near-neutral, very slightly warm greyscale carries the whole interface; colour is reserved for state, category identity and one pocket accent.

### Primary
- **Pocket Accent** (runtime `--sign`; default teal `{colors.pocket-teal}`): the active pocket's own colour, written to the root by the app shell whenever the pocket changes. Used only as a mark: the inset ring on today's day-strip cell (1.5px) and on the category calendar's today (2px), the 14px underline under the active phone tab (and the same short line under payday's date in the phone calendar), the small badge behind today's date in the bills calendar (ink number on it), the current-point dot on the spending line chart, recap progress segments, and the text-selection highlight (with ink text: white on teal, orange or green falls under 3:1). Focus is never the accent: every focus ring is ink, because the lighter pocket colours fall under 3:1 on white.

### Secondary
- **State Green / Amber / Red** (`ok`, `ahead`, `over`): fills for status dots, limit bars and day-strip cells. Their darker text shades (`ok-text`, `ahead-text`, `over-text`) carry state as words and figures, and pass 4.5:1 on white.
- **Category Slots** (`cat-1` to `cat-7`, `cat-other`): one fixed colour per category by the pocket's category order, never by rank, so a category is the same colour on every chart. Validated for colour-vision deficiency (adjacent CVD ΔE ≥ 11.2) and ≥ 3:1 against white.
- **Pocket Colours** (`pocket-graphite` … `pocket-teal`): each pocket's 8px square chip, and the accent while that pocket is active.

### Neutral
- **Soft Page** (`ground`): the page behind everything, and the dialog surface.
- **White Panel** (`board`): panels, sidebar, tab bar, popovers, inputs.
- **Plate** (`plate`): wells, segmented tracks, keypad keys, flap tiles, hover rows, the avatar disc, future day-strip cells.
- **Ink** (`ink`): primary text, primary buttons, selected chips, the active pocket tab's outline, the focus ring, spent bars on the cycle panel.
- **Ink 2** (`ink-2`): labels, secondary lines, inactive nav, category pictograms.
- **Ink 3** (`ink-3`): the quietest marks: the caret beside the pocket switch, scrollbar thumb, the set-aside hatch.
- **Hairline** (`rule`): panel borders, row rules, sidebar and tab-bar edges, limit-bar track.
- **Strong Rule** (`rule-strong`): field edges, outline buttons, the rule over a group.
- **Neutral Mark** (`mark`): on-pace limit-bar fill.
- **Series Ink** (`series`, `series-hi`, `chart-muted`): one-series charts draw the bar that matters (the costliest weekday or the hovered one, the cycle under way) in near-ink and the rest a lighter step, so lighter always reads as context; last cycle and other context lines muted.

Dark mode follows the device (`prefers-color-scheme: dark`) unless the member picks Light or Dark, remembered per device and stamped on the root as `data-theme` so the server renders it; it keeps every role and swaps values: page #0D0D0E, panel #141416, plate #1D1D20, ink #ECECEA, hairline #26272A, brighter state shades. The values live in the sidecar. Dialogs and the phone sheet add a strong-rule edge in dark, where their shadow cannot be seen. In forced colours every chosen chip, thumb, day and tab keeps a 2px system outline, since fills and rings disappear there.

### Named Rules
**The Accent Is A Mark Rule.** The pocket colour never fills a button, never colours a word or figure, and never sits behind content. It outlines, underlines, edges or dots. Native text selection and the bills calendar's today badge are the places it sits behind text, with ink text on it.

**The Ink Acts Rule.** Every primary action is ink on the page colour. A coloured button does not exist in this system.

**The Meaning Or Nothing Rule.** Colour appears only for state, category identity or the active pocket. A bar that is merely on pace is neutral grey; amber and red appear only when a limit needs attention. One-series charts are ink, so blue stays a category colour.

## Typography

**Body Font:** IBM Plex Sans Thai for Thai script, Anuphan Variable for Latin (with -apple-system, Sukhumvit Set, Segoe UI, Roboto)
**Figure Font:** Geist 500 and 600 (with IBM Plex Sans Thai for Thai), tabular digits throughout. The text stack starts with "Geist Figures", Geist limited by unicode-range to digits and the signs around them (% + , - . −), so a figure inside a sentence or a label line is in Geist too. IBM Plex Sans Thai is declared with a Thai-only unicode-range, so English pages never download it.

**Character:** A calm, round Thai-capable sans for words beside a crisp proportional grotesque for money. Geist Mono was tried and dropped: its slashed zeros and full-width commas hurt reading amounts.

### Hierarchy
- **Title** (Anuphan 600, 26px/32px, -0.01em): page titles ("Today", "Bills"), and the sign-in heading.
- **Hero Figure** (Geist 500, 46px phone / 64px desktop in flap tiles; 40/56px for the cycle-only hero; 32–34px for the amount being typed): the one figure a screen leads with.
- **Figure** (Geist 500, 30–40px, -0.02em, no tiles): headline totals on Today's cycle panel, Review, Spending and category pages.
- **Row Figure** (Geist 600, 16–17px): amounts at the right of ruled rows.
- **Row Name** (Anuphan 500, 16px): category and entry names in rows.
- **Body** (Anuphan 400, 15px, line-height 1.45): sentences, captions beside figures ("left today").
- **Label** (Anuphan 500, 12–13px, sentence case, no tracking): panel titles, column heads, status words, nav notes.
- **Small** (Anuphan 400, 11–12px): tab-bar labels, dates under entry names, sub-lines.

### Named Rules
**The Sentence Case Rule.** Labels are sentence case in the text face at weight 500 with zero tracking. The label rule overrides any figure face, weight or tracking set beside it, so a label never turns monospaced, bold or spaced out.

**The Tabular Money Rule.** Every amount, date number and count is in the figure face with tabular digits. Words are never in the figure face. The digits-only Geist face at the head of the text stack keeps this true even inside labels, whose words stay in the text face.

Line height stays at 1.45 for running text because Thai stacks tone marks above vowels.

## Layout

One column on phone, a panel grid on desktop. The page frame is centred, max 600px wide with 16px side padding on phone, widening to 1200px with 32px padding from the `lg` breakpoint (1024px). Panels sit in a 6-column grid at `lg` with dense flow, gaps 12px on phone and 16px on desktop; the page stack gaps 16px / 20px. Reading pages (Settings, a category) keep one 600px column on desktop but start where every other page starts, never centred on their own. On the phone every tap target is at least 44px tall (segmented controls, pocket tabs, chips that save in one tap, Done, Mark paid); desktop controls may sit at 32–36px.

Desktop adds a sticky white sidebar on the left (hairline right edge): the pocket switch, page rows that each carry one live figure, then the ink "New expense" button with its `N` key and the profile row at the foot. Phone replaces it with pocket tabs under the page title and a fixed white tab bar at the bottom, respecting safe-area insets.

Rhythm: panels pad 16px (20px on desktop for titled tiles), rows pad 12px vertically and are separated by hairlines, label lines sit 8–10px above content. Inputs are 16px text so iOS never zooms. Scrollbar gutter is reserved so pages never shift width.

## Elevation & Depth

Flat at rest. Depth comes from tone (soft page under white panels, plate wells inside panels) and from 1px hairlines, never from shadows on resting surfaces. Shadows appear only on layers that float above the page, and on the segmented control's thumb to lift it off its track.

### Shadow Vocabulary
- **Thumb lift** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.08)`): the chosen option of a segmented control.
- **Menu** (`box-shadow: 0 12px 32px -16px rgb(0 0 0 / 0.25)`): the pocket menu under the desktop pocket switch.
- **Popover** (`box-shadow: 0 16px 32px -12px rgb(0 0 0 / 0.5)`): picker dropdowns.
- **Dialog** (`box-shadow: 0 24px 48px -16px rgb(0 0 0 / 0.45)`): modal dialogs.

### Named Rules
**The Hairline Not Shadow Rule.** A resting surface is separated by a 1px hairline or a tone step. If it does not float, it does not cast a shadow.

## Shapes

Small, even corners everywhere. Controls (buttons, inputs, pills, menus, segmented tracks, keypad keys) are 6px; panels are 8px, dialogs included; flap tiles are 3px; small marks (day-strip cells, keyboard hints) are 2px. Only the avatar, status dots and the tab underline are fully round. Pocket chips are sharp 8px squares. Borders are 1px; the only heavier strokes are the 2px dashed outline on an empty "add pocket" tile and the accent outlines on the calendar.

The set-aside pattern, a 135° hatch of 2px lines in the current text colour, marks money held for unpaid bills inside limit bars.

## Components

### Buttons
Plain and ink-led.
- **Shape:** 6px corners; heights 44px default, 36px small, 52px large; label in the label style at 14px.
- **Primary:** ink fill, page-colour text; hover brightens slightly, active darkens slightly. Disabled drops to 40% opacity.
- **Outline:** strong-rule border, transparent; hover fills plate.
- **Secondary:** plate fill; hover steps to the hairline tone.
- **Ghost:** no fill until hover, then plate.
- **Focus:** 2px ink outline, 2px offset, on every interactive element. A field hidden over a visual passes its focus to that visual: the date input's ring goes to its chip, and the typed amount shows a 2px ink line under its flap tiles instead of a box. The add sheet's note field, which sits bare on the board, shows focus the same way, a 2px ink line under its text. Closing a dialog or sheet returns focus to whatever opened it; the phone sheet takes focus as it opens.
- **The add button:** on desktop a full-width ink bar in the sidebar foot with a `N` key hint; on phone a 44px ink square (8px corners) centred in the tab bar with a bold plus.

### Chips
- **Pocket tabs (phone):** outlined pills, 6px corners, hairline border, ink-2 text with the pocket's square chip; the active pocket has an ink border and ink text, not a fill.
- **Choice chips (add sheet: bills, links):** 25% ink border; the selected chip fills ink with page-colour text.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** white panel on the soft page.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px hairline.
- **Internal Padding:** 16px, 20px on desktop tiles.
- **Tile:** a panel with its title on top in the label style (ink title, ink-2 aside), one question per tile.
- **Group:** an unboxed list on the page: a strong rule, a quiet label, then hairline-ruled rows.

### Inputs / Fields
- **Style:** white fill, 1px border in mark grey (3:1 against the panel, so a field reads as a field), 6px corners, 44px tall, 14px side padding, ink-2 placeholder.
- **Focus:** border turns ink, plus the global 2px focus outline.
- **Error / Disabled:** invalid fields take the over-text border; disabled drops to 50% opacity.
- **Search on Spending:** a plate well, 40px tall, no border.
- **Pickers:** the trigger reads as a field; choices open on a white board with the popover shadow. A long list (currencies) opens on the current choice with a search field on top that matches code or name. Its list scrolls with a 6px thumb in the strong-rule tone on no track, so the bar sits inside the board.

### Navigation
- **Desktop sidebar rows:** an 18px outline icon, the page name (medium when active) over a 12px note, and one live figure in Geist at the right. Hover and active rows fill plate; active text goes ink.
- **Pocket switch:** one hairline button with the pocket chip and name; opens a white menu listing every pocket with its headline figure, over-limit headlines in over-text.
- **Phone tab bar:** white, hairline top edge, four outline icons (24px) with 11px labels around the ink add square. The active tab turns ink and gains a short underline in the pocket accent.

### Segmented Control
A plate track (2px inset) with a white thumb in ink at 13px medium, lifted by the thumb shadow; unchosen options are ink-2 and darken on hover. Options are 40px tall on the phone (44px with the track) and 32px on desktop; a strip that scrolls keeps the chosen option in view. It is one Tab stop; arrow keys move and choose, as in any radio group (the pocket colour picker works the same).

The colour mode uses it twice: a System / Light / Dark row in Settings, and on the pages without Settings (sign-in, sign-up, Setup) a compact three-icon version (monitor, sun, moon at 16px, each named for screen readers) beside the language switch or sign out.

### Setup
A new member's first page. One column of Groups (Pocket, Categories, Accounts) with the ink Finish at the foot, and beside it on desktop (above it on the phone) a live preview of their Today board: the first per-day limit leads in flap tiles as on Today, then the chosen categories with their limits. Suggested names are one-tap outline chips (25% ink border, bold plus); a tapped chip becomes a ruled row, and a category row opens its limit controls in place, one at a time.

### Status and Limit Bars
- **Status:** a 6px round dot and a word (On pace, Too fast, Over, No limit) in the label style. "Too fast" replaced "Ahead", which read as good news.
- **Limit bar:** a 4px bar on a hairline track with a 1px pace tick. On pace fills neutral mark grey; ahead fills amber; over dims the spent part to 40% red and shows the overage as its own solid red segment. Money set aside for bills is hatched after the spent part.
- **Day strip:** one 8px cell per day of the cycle, 3px apart, 2px corners: muted green (55%) for days within the limit, red (80%) for days over, plate for days to come, and today as a 1.5px inset ring in the pocket accent.
- **Category calendar:** a per-day limit's cycle as a month grid in the user's week order (Settings: week starts on). Days within the limit are a 15% green tint with the number in ok-text, days over a 15% red tint with the number in over-text (each also says so to screen readers), days to come plate, today a 2px inset accent ring. A tint with its text shade, like a status word, so the grid never outshouts the hero.

### Split-Flap Figure (signature)
One plate tile per character, 0.84em × 1.2em, 3px corners, with a 1px panel-colour line across the middle. The currency sign and separators sit in narrower tiles; the currency sign is ink-2 and smaller. Tiles flip in from -86° on the X axis over 280ms (`cubic-bezier(0.2, 0.7, 0.3, 1)`), staggered 34ms left to right from the first tile that changed (so a typed digit flips at once), and a tile remounts and flips only when its character changes. A deleted character's tile flips away (to 86°, fading, 180ms ease-in) instead of vanishing. An empty typed amount shows dimmed tiles. Reduced motion removes the flip, and with it the dialog zoom, overlay fade and recap slide.

**Currency symbols.** The hero shows the amount exactly as the money module formats it for the pocket's currency and the member's language, so the sign is whatever the platform gives: ฿, $, ¥, €, US$, CHF. The whole sign sits in one tile, however many characters it has. That tile is as narrow as $ (0.62em) and widens with each letter; its glyph is ink-2 at 0.56em, so a three-letter code never outweighs the digits. A space between a code and the digits (CHF 1,234) is an untiled gap. Currencies without minor units, like JPY, get no decimal tiles. When a wide sign or a long figure would overflow the hero board, the whole figure scales down to the board's width (the board is a CSS container); it never wraps, truncates or drops the sign. The typed amount takes the pocket's symbol from the money module and puts it first.

### Keypad and Entry Tape
The add sheet on phone is a 3-column keypad of plate keys (48px tall, Geist 600 at 24px, 6px gap). Batch entry collects lines on a tape: hairline-ruled rows, each led by an 8px square in its category colour, the open row filled plate.

### Category Pictogram
A Phosphor outline pictogram picked from the category name, in ink-2, with no tile or fill behind it; a category with no match shows its initial in the figure face.

### Bills Calendar
A month grid of white cells on hairlines. Day numbers in Geist; picked and hovered cells fill plate; late bills in over red; today's date sits in a small accent badge with an ink number; the pocket's cycle start carries a "Payday" label on desktop ("Cycle starts" in a shared pocket) and a short accent line under the date on the phone, where the word does not fit.

### Settings Pocket Tiles (sanctioned exception)
Pockets in Settings are "card in a pocket" tiles: the pocket's coloured card peeks 24px above a white panel, printed tone on tone: the pocket's initials (first letter of its first two words) in Geist 600 at 28px, set low so the pocket half-covers them until a pull, a darker band with a thin light rule beside it, faint halftone dots fading in from the right, and a 1px light top edge. On hover or focus it slides up 10px and tilts 1.5–3°, left or right at random on every pull, like a card tugged from a pocket, over 200ms ease-out, while a faint gloss drifts across it over 900ms; reduced motion keeps the slide and drops the tilt and the gloss. An empty slot is a 2px dashed ink-3 outline that turns ink on hover, with its dashed card hidden inside until a hover or focus pulls it up the same way. This is the only hover motion beyond colour in the system, chosen explicitly by the user.

### Icons
Phosphor icons. Navigation, pictograms and status icons use the regular weight at 16–24px; small action glyphs (plus, carets, arrows, close, check) use the bold weight at 12–16px so they hold up at that size.

## Do's and Don'ts

### Do:
- **Do** put every primary action in ink (#111213) with page-colour text, 6px corners.
- **Do** separate resting surfaces with a 1px hairline (#E8E8E5) on white panels over the #FAFAF9 page.
- **Do** set every amount, date number and count in Geist 500/600 with tabular digits, and every word in Anuphan in sentence case.
- **Do** use the active pocket's colour only as a mark: today's cell, the active tab underline, the calendar's today badge and payday line, chart current points.
- **Do** show state as a dot, a word in the -text shade, or a thin bar; keep on-pace bars neutral grey.
- **Do** give each category its fixed slot colour by category order on every chart, and draw one-series charts in ink.
- **Do** keep split-flap tiles for Today's hero figure (and its Setup preview) and the amount being typed, and keep motion to figures flipping and the pocket-switch crossfade.
- **Do** keep corners at 6px for controls, 8px for panels, 3px for flap tiles and 2px for small marks.

### Don't:
- **Don't** fill a button, a word or a figure with the pocket accent.
- **Don't** use uppercase or tracked labels; labels stay sentence case with zero tracking.
- **Don't** put category pictograms on filled icon tiles; they are bare outline glyphs.
- **Don't** put flap tiles on any figure other than Today's hero (and its Setup preview) and the amount being typed.
- **Don't** hardcode a currency sign or split one across tiles; take the sign from the money module and give it one tile.
- **Don't** cast shadows on resting panels, rows or buttons.
- **Don't** colour a bar amber or red unless its limit needs attention, and don't use blue for a one-series chart.
- **Don't** use Geist Mono or any monospaced face for money.
- **Don't** use dark boards, yellow wayfinding or the previous departure-board vocabulary.
