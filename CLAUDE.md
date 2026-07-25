# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Personal site for Khosraw Azizi, hosted on GitHub Pages at khosraw.com. Two deliberately minimal static pages: a home screen (name, role, origin, links) and a writing index.

The guiding constraint is restraint. Proposals to add sections, animations, analytics, frameworks, or JavaScript should be treated as regressions unless explicitly requested.

## Files
- **index.html** — the home page. Four content elements inside one `<main>`.
- **writing/index.html** — the writing index. Currently a placeholder reading "No original thoughts to share."
- **css/style.css** — all styling for both pages: `@font-face` declarations, design tokens, layout, entrance animation.
- **fonts/** — self-hosted woff2 files: Boska light (300), Satoshi regular (400) and medium (500).
- **CNAME**, **favicon.png**, **thumbnail.png** — domain, favicon, Open Graph image.

There is no build step, no package manager, and no JavaScript.

Pages share `css/style.css` and reference assets with root-relative paths (`/css/...`, `/fonts/...`) so any page nests at any depth. `writing/index.html` gives the clean `/writing` URL without server config.

## Adding a Blog
No static-site generator is installed, and that is a deliberate choice while the post count is zero — tooling would exceed the content it manages. When there are genuinely posts to maintain (roughly 3+, or when an index, tags, or RSS is wanted), **Astro** is the intended direction: Markdown content collections, type-safe frontmatter, zero JS shipped by default. Eleventy is the lighter alternative; Jekyll is the only option GitHub Pages builds natively without an Action.

Until then, hand-written HTML per post is fine.

**Do not fetch and render Markdown client-side** (e.g. `marked`). It would add JavaScript to pages that have none, and posts would not be crawlable or readable without JS.

## Development Commands

```bash
# Serve locally
python3 -m http.server 8000
```

**Use a plain static server, not VS Code's Live Preview extension.** Live Preview gates requests behind an auth cookie, and browsers always fetch `@font-face` files in CORS mode, which omits cookies — so every font 401s while the HTML and CSS load fine. The symptom is a header that looks too heavy, because Boska silently falls back to macOS Didot (which has no light weight). Verified: the same file on the same Live Preview server returns 200 for a plain request and 401 when an `Origin` header is present. Neither `python3 -m http.server` nor GitHub Pages behaves this way.

Do not "fix" this by inlining fonts as base64 data URIs. It would bloat the stylesheet by ~110KB, defeat font caching, and make the CSS unreadable, all to work around one editor extension.

### Deployment
Pushing to `main` auto-deploys via GitHub Pages.

## Typography
Two typefaces, both from Indian Type Foundry via Fontshare, with a strict division of labor:

- **Boska** (weight 300) sets the name and nothing else. It is a very high-contrast didone display face.
- **Satoshi** (400 and 500) sets all remaining text.

**Do not set small text in Boska.** This was the original design and it failed: measured at 12px, 64% of the inked pixel columns in "GITHUB" were near-invisible hairlines (≤3 subpixels at 3x), versus 1% for Satoshi. Its hyphen effectively vanished, which is why the role line once read "Cofounder" instead of "Co-founder". Boska earns its place by being large and used once; it is a liability anywhere else.

**Fonts are self-hosted, not linked from Fontshare.** Fontshare's hosted CSS uses protocol-relative `//cdn.fontshare.com` URLs, which fail over plain http and add a third-party round trip. Files live in `fonts/` with local `@font-face` rules. Do not replace this with a CDN `<link>`.

Weight carries the hierarchy in the two body lines: the role is 500, the location 400 and muted.

## Design Tokens
Colors are CSS custom properties on `:root`, overridden in a single `prefers-color-scheme: dark` block. Change a color once in the token, never inline. `--serif` and `--sans` hold the two font stacks; `--gutter` and `--rise` control page margin and the block's optical rise above true center; `--ease-out` is the shared entrance easing.

## Motion
Navigation is the only animation: a cross-page dissolve via cross-document view transitions. There is **no entrance fade on load** and no per-element stagger.

Supported in Chromium 126+ and **Safari 18.2+** (shipped Dec 2024). Firefox is still in progress and simply navigates normally.

### The navigation flicker — root cause and fix
The real cause, per Chrome's and MDN's documentation: **the browser can start the transition before the destination document has finished parsing**, so it animates toward an unstyled, half-built page. Browsers use their own heuristics about when to first paint, so without an explicit hint the timing is inconsistent — which is why the severity differed between browsers rather than being absent in one.

The documented fix is render blocking. Each page's `<head>` carries:

```html
<link rel="expect" blocking="render" href="#content">
```

`<main id="content">` is the target. This holds the first paint until `<main>` is parsed, so the transition always animates against a stable page. Parsing continues in the background; only painting is deferred. **This is the fix that matters. Do not remove it.**

Required alongside it:

- **Stylesheets must stay in `<head>`.** They are render-blocking by default there; move them and the guarantee is lost.
- **`html` needs a background.** A transition composites both snapshots over the root element, so with a background only on `<body>`, gaps expose the browser's default white.
- **Both pages need the `@view-transition` opt-in.** If either side lacks it, no transition occurs.
- **No entrance fade on `<main>`.** An `opacity: 0 -> 1` animation makes every first paint blank, adding a blank frame on top of the transition.
- **Reduced motion** is handled by gating the at-rule in `@media (prefers-reduced-motion: no-preference)` — the documented approach — rather than zeroing the animations afterward.

Keep `::view-transition-old(root)` and `::view-transition-new(root)` on the same `--fade` duration; mismatched durations leave a window where the old page is gone and the new one is not yet opaque.

Also worth knowing: if the destination takes more than **4 seconds** to become renderable, Chrome skips the transition with a `TimeoutError`. Render blocking pushes toward that budget, so keep blocking scoped to `#content` only.

### Failed fixes — do not retry
Several plausible-sounding fixes were tried and did not work, because the cause was misdiagnosed as an opacity/animation conflict:

- **`html:active-view-transition main { animation: none }`** — suppressed the entrance fade during the transition. Treated a symptom; the guard also released mid-animation when durations differed.
- **Unifying entrance-fade and transition durations** — made the guard consistent but fixed nothing.
- **`font-display: optional`** — intended to stop a font swap flash. Actively harmful: it lets the browser abandon the webfont for a whole pageview. Verified failing on a throttled cold load, where the name rendered at the fallback's exact width while `document.fonts.status` was `loaded`. Stay on `block`.

A trace that sampled `main`'s computed opacity every frame across real navigations showed opacity **flat at 1.0 the entire time**. That ruled out the whole opacity theory and should have prompted research much earlier.

Hover transitions are asymmetric on purpose: 0.15s in, 0.4s out.

## Verifying Changes
Manual checks in a browser:
- **Confirm both webfonts actually loaded, and are actually rendering.** These differ: `document.fonts.status` can report `loaded` while the browser paints the fallback. Measure rendered text width against a nonexistent font name — if they match, the webfont is not in use. macOS falls back to `Didot` for Boska, which looks similar but heavier, so a visual check is not sufficient. This has silently shipped once already.
- **Verify `link[rel=expect]` resolves.** If its `href` does not match a real element id, render blocking silently does nothing.
- Both color schemes, via DevTools rendering emulation.
- 320px width — the name must not overflow, and all four nav links should stay on one row.
- `prefers-reduced-motion`, which must leave the page fully opaque and disable the `@view-transition` opt-in.
- **Navigate between `/` and `/writing` repeatedly in both Chromium and Safari**, in dark mode, on a throttled cold load as well as a warm cache.

Note on measuring frame rate: `requestAnimationFrame` is throttled to roughly 1fps when the browser view is unfocused, which looks like a severe regression but is an artifact. Check `document.hasFocus()` first.
