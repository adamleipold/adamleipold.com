# adamleipold.com

Static HTML on Vercel, no build step.

## Status — Jesus in Prayer — From the Stars

Published 2026-09-05. `index.html` is the page: Alton S. Tobey's painting
(1963, Adam's collection) as a living field of marks, painted on the
reader's device by `glyph-sequence.js` from `jesus-in-prayer.sequence.json`.
The page copy is a placeholder until Adam's words arrive. `/` is the
canonical URL; `/jesus-in-prayer-from-the-stars` rewrites to it.

Two homepage directions were built and both are retired: the
painting-led concept D (context decision 0014) and a hand-drawn SVG
garden (context decision 0016). The site's public direction is now
project-led — context decision 0015 — and that design does not exist
yet.

Do not restore either old homepage. Do not build a new one
speculatively. The next UI starts from Adam's decision about what he is
publishing.

## What the repo keeps

```
index.html                     holding page, no design
images/                        painting web sizes (2400/1200), OG card
css/gethsemane-palette.css     colour tokens — pigment + screen tiers
css/gethsemane-palette.json    the same, machine-readable
fonts/                         self-hosted woff2 (CSP forbids external hosts)
scripts/prepare_painting.py    regenerates painting assets from the original photo
_drafts/                       Adam's writing, markdown source of truth
docs/                          briefs, copy deck, review notes, reference comps
vercel.json                    headers, clean URLs, CSP
```

The **screen tier** of `gethsemane-palette` is the site's working colour
set; the **pigment tier** is for art direction. Both are sampled from
Alton S. Tobey's *Jesus in Prayer*, which Tobey painted for Adam. Adam
owns the original and holds reproduction rights from David Tobey and
Todd Anderson; any public use is a deliberate decision and always
attributes the work to Alton S. Tobey.

`_drafts/` holds two finished pieces — *The God of Perfect Timing* and
*AI Is Not a Surprise to the Architect*. They are written and ready.
They are not currently published because there is no site to publish
them into.

## Deploying

Vercel serves the repo root as-is: framework preset **Other**, build
command and output directory both empty. Pushes to `main` publish to
production; any other branch produces a preview URL.

## Governing records

The site is governed by the private `context` repo, not by this README.
Relevant decisions: 0008 site purpose, 0010 devotionals as permanent
pages, 0014 concept D (superseded), 0015 project-led direction, 0016
photoreal scenes are sourced rather than hand-drawn.
