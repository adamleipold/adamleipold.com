# Version One — Implementation Plan & Status

**Spec:** `docs/superpowers/specs/2026-08-09-cinematic-homepage-sable-brief.md`
**Palette:** `css/site.css` tokens = `gethsemane-palette` screen tier (Drive: adamleipold.com — design handoff)
**Implementer:** Sable (Claude Code)

## Decisions applied

- Scene structure per the 2026-08-09 repo brief and decision 0011:
  Presence → Invitation → two writings → Horizon. The 08-06 Drive
  brief's seven-station list is superseded by 0011 (no empty rooms).
- Fonts self-hosted in `/fonts` (Instrument Serif 400/400i, IBM Plex
  Sans variable 300–500, IBM Plex Mono 400/500, latin subset). The
  comp's Google Fonts links violated the CSP in `vercel.json`
  (`default-src 'self'`) — they render locally and fail silently in
  production. CSP stays strict.
- Comp color tokens normalized to the palette screen tier — the brief
  names it the working set. Comp's hotter gold `#F0C24B` maps to
  `--accent-moon-hot` (hover state only).
- Gold rationed to one element per view: home = the lit phrase in the
  statement; writing pages = the drop cap. Nothing else is gold.
- Still static HTML, no build step. Two pages does not justify Astro.

## Done

- [x] `css/site.css` — tokens, self-hosted fonts, home scenes, reading pages
- [x] `index.html` — four-scene homepage; statement & invitation marked
      as placeholder copy awaiting Adam
- [x] `/writing/ai-is-not-a-surprise-to-the-architect` — shell ready for text
- [x] `/writing/god-of-perfect-timing` — shell ready for text
- [x] `vercel.json` — immutable cache for fonts

## Blocked on content (laptop-side)

- [ ] `python3 prepare_painting.py IMG_1178.jpeg public/images/` → commit
      the three JPEGs to `/images` (page headers pick them up as a
      `background-image` layer over the gradient; missing file degrades
      silently to the gradient)
- [ ] Move both writings' markdown into `_drafts/`, convert into the
      `<article>` of each page per the inline notes, delete `.awaiting`
- [ ] Adam's final statement + invitation copy

## Release (per acceptance test in the spec)

- [ ] `main` created / production branch set in Vercel (Adam + Lisa)
- [ ] Verify `.vercel.app` preview: mobile, desktop, both writing URLs,
      reduced motion, headers
- [ ] GoDaddy A/CNAME per Vercel's domain screen
