# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a personal portfolio website for Khosraw Azizi hosted on GitHub Pages at khosraw.com. It's a static single-page application featuring an interactive Three.js particle animation that forms the name "KHOSRAW AZIZI" with dynamic effects.

## Development Commands
Since this is a static website with no build process, development is straightforward:

### Running the site locally
```bash
# Option 1: Python (if installed)
python -m http.server 8000

# Option 2: Node.js (if installed)
npx http-server

# Option 3: VS Code Live Server extension
# Right-click index.html → "Open with Live Server"

# Option 4: Direct file access
# Simply open index.html in your browser
```

### Deployment
```bash
# All changes pushed to main branch auto-deploy via GitHub Pages
git add .
git commit -m "Your commit message"
git push origin main
```

## Architecture and Key Components

### Core Files
- **index.html**: Single-page structure with hero and about sections
- **css/style.css**: All styling including responsive design, custom cursor, and CSS variables
- **js/particles.js**: Three.js particle system that creates the animated name effect
- **js/cursor.js**: Custom cursor implementation with hover effects

### Particle System Architecture
The particle system uses birthdate (December 5, 2005) as a seed for generative elements:
- Renders text to canvas to extract pixel positions
- Creates particles at text positions with physics simulation
- Implements mouse/touch interactions (attraction/repulsion)
- Background star field with twinkling and supernova effects
- Mobile optimizations with reduced particle counts

### Design Patterns
- **No build process**: Direct HTML/CSS/JS without preprocessing
- **CDN dependencies**: Three.js, Font Awesome, Google Fonts loaded from CDNs
- **Mobile-first**: Extensive responsive breakpoints and touch event handling
- **Performance optimized**: Adaptive particle counts based on device capabilities

### Development Considerations
- The site uses relative paths for all local assets
- Custom cursor is automatically disabled on touch devices
- Particle animations cycle every 10 seconds with wave effects at 19-second intervals
- Double-click/tap triggers explosion effect
- All visual effects are GPU-accelerated using WebGL via Three.js

## Testing Approach
Manual testing across devices and browsers. Key areas to verify:
- Particle animation performance on various devices
- Custom cursor behavior on desktop
- Touch interactions on mobile
- Responsive layout at different breakpoints
- Cross-browser compatibility (especially WebGL support)