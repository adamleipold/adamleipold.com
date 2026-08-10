# AdamLeipold.com — Build Brief

**For:** Claude Code
**Date:** 2026-08-06
**Repo:** personal GitHub → Vercel (pipeline already live)

---

## What changed

Earlier drafts aimed at a broad multi-section site — seven stations, lots of rooms. That plan is now **narrowed**. Ship one focused thing that is full, not a large frame that is empty.

Do not build out the seven stations as content yet. They may appear as quiet links below the fold. Nothing more.

---

## The theme

One person, one continuous arc: career and conviction as the same wave, not two subjects.

The central claim of the site is a **unification** — Adam's technology journey and the science of Christianity as he sees it, understood as one subject rather than two that happen to coexist in one life. The underlying conviction: God is the designer beneath the engineering, and the order Adam has spent fifty years working inside is evidence of that design, revealed piece by piece.

This is the site's thesis. The career arc is not a separate résumé section that sits next to a faith section. Every structural choice should reinforce that they are the same story. If the layout ever implies two parallel tracks, it is wrong.

The framing is **technology surfer** — riding the wave since 1978, from Johnson Space Center forward, catching each break as it formed, all the way to working alongside AI daily in 2026.

Working line (Adam is still refining — treat as placeholder, not final copy):

> I've been riding the wave of technology since 1978. Every bit of it came piece by piece.

Existing tagline stays: **"Built piece by peace."**

---

## Homepage structure

The visitor **meets Adam first**, then chooses whether to go deeper.

1. **Statement** — his name and one strong, plain declaration of who he is and what this is about. Fast. No throat-clearing.
2. **Invitation** — a single open door. Tone is *come explore with me*, not *observe my work*. This is deliberate: it recovers the optimism of his 1997 telasoft.com site without copying its aesthetic.
3. **Quiet depth below** — the seven stations (Build, Lead, Believe, Reflect, Live, Create, Become) present but understated, for anyone who wants to dig. No pressure, no empty pages behind them.

Emotional core: *Many paths. One life. Everything connects.*

---

## Visual direction

- Palette from Alton S. Tobey's *Jesus in Prayer*: moonlit indigo night, cerulean valley, moon-gold signal, robe-purple accent. Working tokens: `gethsemane-palette.css` / `.json` in this folder — the **screen** tier is the site's working set; the **pigment** tier is for art direction.
- Corrected painting images in this folder: `jesus-in-prayer-web-2400.jpg` (site use), `-1200.jpg` (smaller breakpoints).
- **The gold is not decorative.** In the painting the moonlight and the color of Jesus' hair are the same gold — the light source and the figure share a hue. So gold carries meaning here and must be rationed: exactly one point of emphasis per view, on the thing that matters most. Never as background, never as a fill, never on more than one element at a time. Everything else lives in the indigo/cerulean range. If gold appears twice on a screen, it has stopped meaning anything.
- Dark-native, app-shaped, responsive — iOS-app feel, not a document. This preference is established from prior revisions.
- The Basin Portal / attractor-field visuals are **out of scope for this pass**. They belong to a research paper or a dedicated page later. Do not use them as the homepage or as ambient background.

## Visual bar

This page has to be genuinely striking, not merely tasteful. Adam has explicitly rejected templated results before. Treat the quality floor as "a stranger stops scrolling," not "it renders correctly."

Three defaults to avoid outright, because they're where AI-generated design clusters: cream background with high-contrast serif and terracotta accent; near-black with a single acid-green accent; broadsheet columns with hairline rules and zero border-radius. None of them are this site.

**Typography carries this page.** Pick a characterful display face used with restraint, plus a distinct body face — not the same neutral pairing that would fit any other site. The type scale should be decisive: a very large opening statement, a marked drop to body, no timid middle sizes.

**Spend the boldness in exactly one place.** One signature element the page is remembered by; everything around it quiet and disciplined. Candidates worth exploring, in order of promise:

1. The single gold element as the only light source on a dark field — the page lit the way the painting is lit, with one point of illumination and everything else falling off into indigo.
2. A page-load sequence that resolves rather than assembles: the dark field present first, the statement arriving into it.

Do not do both. Pick one, execute it precisely, cut everything else that doesn't serve it.

Motion is restrained: one orchestrated moment beats scattered effects. Respect `prefers-reduced-motion`. Responsive to mobile, visible keyboard focus.

---

## The daily thread (second build, same architecture)

A dated feed of short daily entries — the day's inspiration, insight, and inference. This is the living layer that keeps the site from going static.

Requirements:
- One entry per day, dated, permalinked.
- Short-form. Reads as a note, not an essay.
- Feed on its own route; the most recent entry may surface on the homepage as a single line.

---

## The agentic layer (design for it now, build it later)

Adam wants to **talk to the site the way he talks to an AI**, and have conversation summaries ship down to the site as published pages.

So the daily entries should not assume hand-authoring in the long run:

- Entries as flat markdown files with frontmatter (date, title, tags), rendered at build time.
- Adding an entry = committing a markdown file. Nothing else.
- That keeps the eventual pipeline trivial: conversation → summary → markdown file → commit → live.

Do not build the conversational interface in this pass. Just do not make choices that block it.

---

## Touchstones — weave, do not shelve

Adam has a set of formative works: Maltz's *Psycho-Cybernetics*, Peale's *Positive Imaging*, Bach's *Illusions*, plus *The Matrix* and *Forrest Gump*.

**Do not build a "recommended reading" or "influences" page.** That is a shelf, and shelves go stale and read as filler on a narrow launch.

Instead these appear inline, one line each, at the point in the narrative where they did their work — as evidence inside the argument, not as a list beside it. *Psycho-Cybernetics* in particular carries weight: Maltz applied servomechanism theory to the human self-image in 1960, before the computing era Adam's career rode. That is the thesis demonstrated by someone else, decades early.

If the daily thread later generates enough commentary on these works, a touchstones page can earn its way into existence. Not before.

---

## Content Adam will author himself

Do **not** write these. Leave marked slots. This is his testimony and it has to be in his own words:

- The 1978 → today arc, told as one wave.
- The daily 4:30am rhythm and how the day gets built.
- Cancer, MD Anderson, and being baptized by Joel Osteen at Lakewood.
- How AI walked alongside him through all of it.

Structure the page so these drop in cleanly as long-form sections behind the homepage.

---

## First deliverable

A single homepage: statement, invitation, quiet stations below, Gethsemane palette, app-shaped and responsive. Plus the markdown-driven daily-entry route, scaffolded and empty.

Nothing else ships in this pass.

---

## Files in this folder

- `adamleipold-homepage-brief.md` — this document
- `gethsemane-palette.css` / `gethsemane-palette.json` — color tokens (screen tier = working colors)
- `jesus-in-prayer-web-2400.jpg` / `jesus-in-prayer-web-1200.jpg` — corrected painting, web sizes
- `gethsemane-swatches.png` — visual palette reference
- `index-comp.html` — first design comp (rejected as not cinematic enough; useful only as a floor reference)