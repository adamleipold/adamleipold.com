# Version One — Implementation Plan & Status

**Copy:** `docs/copy-deck.md` (v2.1 APPROVED, verbatim)
**Design brief:** `docs/homepage-brief.md` · **Spec:** `docs/superpowers/specs/2026-08-09-cinematic-homepage-sable-brief.md`
**Concept:** D — "the painting is the world," chosen by Adam 2026-08-09
after A/B/C/D exploration. Build go given 2026-08-09 (late).

## Decisions applied

- Concept D: full-bleed painting as fixed atmosphere, graded to .66
  brightness with directional scrim; figure is center of gravity, not
  subject (per Lisa's review). Crop dialed back one notch from the
  mockup (70% 38%).
- The signature animation is the load resolve: void → night kindles
  (4.2s) → statement → ledger → hinge → invitation. Perpetual layers:
  55s breath (scale 1→1.05), 12s moonglow swell. All dead under
  `prefers-reduced-motion` (moonglow pinned at .35).
- Copy deck v2.1 verbatim throughout. Sub-statement rendered as the
  17/22/4:30 ledger — same words, typographic structure only.
- Stations are quiet non-link rows (no empty destinations, per 0011).
  Testimony slots visible, marked "coming soon," prompts as HTML
  comments — Adam's voice only.
- `/daily` exists per the deck, noindex until the first entry; homepage
  carries a commented slot for the latest-entry line. Not linked from
  any visible element yet.
- OG image is the dark statement card (deck §6), not the painting.
- Fonts self-hosted; CSP unchanged (`default-src 'self'`); fonts
  immutable-cached, images 1-week cache.

## Done

- [x] Homepage — concept D, full deck copy
- [x] `/writing/ai-is-not-a-surprise-to-the-architect` — shell, painting header (sky crop)
- [x] `/writing/god-of-perfect-timing` — shell, painting header (valley crop)
- [x] `/daily` — quiet empty state, noindex
- [x] Painting assets in `images/` (2400/1200) + swatch sheet in docs/reference
- [x] `images/og.png` — statement card 1200×630
- [x] README rewritten; vercel.json caching

## Blocked on content

- [ ] Both writings' markdown into `_drafts/`, converted per inline notes
- [ ] Testimony sections (Adam writes; slots ready)
- [ ] First daily entry (Adam writes; then de-noindex, link on homepage)

## Release

- [ ] Production branch set in Vercel (Adam + Lisa) — repo default is
      `claude/connection-status-fzv40e`; site work is on
      `claude/claude-code-work-repo-cj9wgw`
- [ ] Verify preview: mobile, desktop, writing URLs, reduced motion,
      headers, CSP (fonts/images load from self)
- [ ] GoDaddy A/CNAME per Vercel's domain screen
