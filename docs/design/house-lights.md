# The Orbital & Bar — "house lights" revision

Design note for the UI rework after the v1 "retro-futurist cocktail lounge" pass.
Same bar, same personality; the lights are turned up to reading level so the page
can be used for a whole shift without eye strain.

## What made v1 tiring

Measured on the deployed site at 1250, 1440 and 2560 px:

- **Bitmap body text.** Everything was set in VT323 (a pixel font) at 20 px. It reads
  like a terminal for ten seconds and like a strain after ten minutes.
- **Micro-caps everywhere.** ~1,900 text nodes were under 12 px: letter-spaced mono
  uppercase for labels, source badges (10 px), section titles, hints, stats.
- **Contrast whiplash.** Bright cream tickets (L ≈ 92) on a near-black wood-grain shelf
  (L ≈ 8), plus a vignette and a blueprint grid over the body. Every eye movement
  between sidebar and card crossed the full luminance range.
- **Permanent motion.** Neon flicker on the sign (6 s loop, forever), a blinking cursor
  in the search box, a skeleton shimmer, cards lifting on hover with 36 px shadows.
- **Texture on top of text.** Lined-paper stripes behind ingredient rows, torn
  clip-path edges, rotated over-stamps, strength-tinted paper that made "lethal" cards
  darker and lower-contrast than the rest, a decorative barcode in every footer.
- **Glow as a colour.** Rose and cyan were applied as text-shadows and box-shadows,
  which blurs edges and lowers effective contrast.

## What has character and stays

- The name and the sign: **THE ORBITAL & BAR**, eyebrow *Deck 7 · Promenade · Est. 2441*,
  sub-line *Bartender Companion Terminal*. Limelight stays as the display face for the sign.
- The palette family: oxblood ink, bone, brass, with rose and cyan as accents.
- The **order ticket**: a paper card with a coloured staple, a strength bar, a
  "№ serial", stamps for notable properties, and the pixel sprite in a dark bezel.
- The bar voice in copy: *on the rail · in the book*, *The Menu*, *Tune the list*,
  *Shelf Empty*, *Stamp Legend*, *DEV* terminal.
- The interactive bits: source toggles with counts, ingredient-availability categories,
  the recipe tree (*Builds from* / *Used in*), the developer view.

## What is calmed down

| v1 | now |
|----|-----|
| VT323 20 px body | IBM Plex Sans 16 px body, Plex Mono ≥ 12 px for data labels, VT323 only inside the DEV terminal strip at ≥ 16 px |
| Neon glow + flicker on the sign | Solid rose sign with a single soft halo; no animation |
| Cream paper on black wood | Warm paper (`#eadfc8`) on a lifted ink shelf (`#241519`); no wood grain, grid or vignette |
| Lined paper, torn edges, tinted paper per tier | Flat paper, straight edges, one 4 px strength bar and a staple colour carry the tier |
| Rotated over-stamps at 40 % opacity | Upright stamps in the footer at full contrast; the legend stays in the sidebar |
| Letter-spaced 10–11 px caps | 12 px mono labels with 0.06 em tracking; badges 12 px |
| Hover lift + big shadow | Border and background shift only |
| Blinking cursor, shimmer | Static prompt glyph; skeleton uses a static two-tone block |

## Rules

**Type**
- Body text ≥ 16 px (`--fs-body`), secondary ≥ 14 px, mono labels and badges ≥ 12 px.
- Uppercase only for short labels (≤ 3 words) and never below 12 px; tracking ≤ 0.08 em.
- Limelight only at ≥ 20 px (sign, empty-state title). VT323 only at ≥ 16 px (DEV strip).

**Colour & contrast (WCAG AA for text, 4.5:1)**
- On ink: `--bone` 14:1, `--bone-2` 9:1, `--bone-3` 5.4:1 (smallest allowed for text).
- On paper: `--paper-ink` 11:1, `--paper-ink-2` 6.2:1; coloured inks (rose, green, blue,
  amber, plum) are all ≥ 4.6:1 on `--paper`.
- Rose, cyan, amber and mint are accents: staples, bars, dots, one-word badges. Never
  as body text, never as glow.

**Motion**
- No infinite or looping animations. Transitions ≤ 150 ms for colour/border, 200 ms for
  the drawer. `prefers-reduced-motion: reduce` removes all transitions and smooth scroll.

**Spacing & layout**
- 4 px scale (`--space-1` … `--space-8`). Card padding 16–20 px; row gap 6 px.
- Page content is a centred container, `max-width: 1880px`, so 2K/4K screens are used
  without stretching a card past ~520 px.
- Sidebar 300 px, sticky; content grid `repeat(auto-fill, minmax(min(100%, 380px), 1fr))`.
- Two-column layouts use `minmax(0, 1fr)` and collapse at 1024 px (sidebar moves into
  the drawer). Nothing may overflow horizontally at 1250 px or below.
- One theme. The bar is a dark room with paper tickets; a light mode would be a
  different bar.

**Responsive**
- ≥ 1880: centred, 4 cards per row. 1250–1880: 2–3 cards. 1024–1250: 2 cards.
- < 1024: filters in the drawer, single/double column cards. < 640: single column,
  card padding 14 px, sign 32 px.
