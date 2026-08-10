# adamleipold.com

Personal site. Static HTML, no build step. The homepage is Tobey's
*Jesus in Prayer* receded to atmosphere, with Adam's statement resolving
into it — see `docs/copy-deck.md` (copy source of truth, verbatim) and
`docs/homepage-brief.md` (design brief).

## Layout

```
index.html            the homepage; resolves on load, then breathes
writing/<slug>.html   permanent authored pages (long-form, image-capable)
daily/                dated thread; ships empty, first entry is Adam's
css/site.css          all styles; tokens are the gethsemane screen tier
css/gethsemane-palette.{css,json}   palette reference (pigment + screen)
fonts/                self-hosted woff2 (CSP forbids external hosts)
images/               painting assets + og card
scripts/prepare_painting.py         regenerates painting assets from the original photo
docs/                 briefs, copy deck, review notes, reference comps
vercel.json           headers, clean URLs, CSP
```

## Rules that bind edits

- **Copy is Adam's, verbatim.** The statement, sub-statement, stations,
  and taglines come from `docs/copy-deck.md`. Never edit, tighten, or
  spell-correct ("piece by peace" is intentional).
- **Testimony is Adam's voice only.** The four slots (The Wave, 4:30 AM,
  MD Anderson, Line Upon Line) ship as visible placeholders. No AI
  drafting, ever.
- **Gold appears once per view.** The lit phrase on the homepage; the
  drop cap on a writing page. If gold shows twice on a screen, it has
  stopped meaning something.
- **No external assets.** CSP is `default-src 'self'`. Fonts and images
  live in this repo. External references fail silently in production.
- **The painting keeps Tobey's monogram.** Never crop or retouch it out.
  Attribution rides in the page foot: Alton S. Tobey · "Jesus in Prayer".
- **Motion respects `prefers-reduced-motion`** — everything stops.

## Deploying

Vercel serves the repo root as-is: framework preset **Other**, build
command and output directory both empty.

- Pushes to the production branch publish to adamleipold.com.
- Pushes to any other branch produce a preview deploy on a generated URL.

## Adding content

- **A writing:** drop the markdown in `_drafts/`, convert into the
  `<article class="piece-body">` of its page per the inline notes,
  delete the `.awaiting` block.
- **A daily entry:** `/daily/YYYY-MM-DD.html`, then surface its title as
  the one quiet dated line on the homepage (slot is marked in
  `index.html`). Remove `noindex` from `/daily` with the first entry.

## Stack

Static HTML is deliberate — no build step to break, no dependencies to
age. If the daily thread makes hand-conversion tiresome, Astro is the
agreed upgrade path (see `docs/homepage-brief.md`, agentic layer).
