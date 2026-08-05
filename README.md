# adamleipold.com

Personal site. Static HTML, no build step.

## Layout

```
index.html     the page; inline <style>, no external assets
vercel.json    headers, clean URLs
```

## Deploying

Vercel serves the repo root as-is. There is no build command and no
framework preset — the correct Vercel setting is **Other**, with build
command and output directory both left empty.

- Pushes to `main` publish to production.
- Pushes to any other branch produce a preview deploy on a generated URL.

## Adding copy

Copy goes inside `<main>` in `index.html`, below the `<h1>`. Styles for
`p`, `a`, and `ul.links` are already defined; a `p.lead` class is
available for an opening line in muted text.

## Stack

Static HTML is a deliberate choice, not a placeholder — it has no build
step to break and no dependencies to age. If the site starts publishing
markdown-driven content, Astro is the intended upgrade path, and this
file is one commit away from being replaced.
