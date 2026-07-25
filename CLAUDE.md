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
The page arrives and leaves as a single object. There is deliberately **no per-element stagger** — an earlier version animated the name, lines, rule, and each link separately, and it read as fussy rather than composed.

Two pieces:

- **On load**, one `fade-in` animation on `<main>`. Opacity only, ~950ms.
- **Between pages**, cross-document view transitions (`@view-transition { navigation: auto }`) fade the outgoing page out while the incoming one fades in, so navigation dissolves instead of cutting. This needs no JavaScript, and browsers without support just navigate normally.

Rules to preserve:

- **Animate only `opacity` (and `transform` if ever needed).** Both are compositor-only, so nothing triggers layout or paint.
- **Do not reintroduce per-element animation.** If an element seems to need its own entrance, the answer is almost certainly no — the whole point is that everything appears together.
- **`prefers-reduced-motion` must disable both** the load fade and the view transitions.

Hover transitions are asymmetric on purpose: 0.15s in, 0.4s out. Fast response on enter, gentle release on leave.

To inspect either animation, throttle it via DevTools Animations (or CDP `Animation.setPlaybackRate`) — at real speed both are too quick to see mid-flight.

## Verifying Changes
Manual checks in a browser:
- **Confirm both webfonts actually loaded.** macOS falls back to `Didot` for Boska, which looks deceptively similar but heavier, so a visual check is not sufficient — this silently shipped once already. Check the network panel for 200s on the woff2 files, or measure rendered text width against a nonexistent font name; if they match, the font is not loading.
- Both color schemes, via DevTools rendering emulation.
- 320px width — the name uses a non-breaking space and must not overflow, and all four nav links should stay on one row.
- `prefers-reduced-motion`, which must leave the page fully opaque with no animation.
- The cross-page fade, by slowing playback and navigating between `/` and `/writing`.

Note on measuring frame rate: `requestAnimationFrame` is throttled to roughly 1fps when the browser view is unfocused, which looks like a catastrophic performance regression but is only an artifact. Confirm `document.hasFocus()` before trusting any rAF-based measurement.
