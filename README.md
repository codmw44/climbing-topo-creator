# Beta Creator — Climbing Route Topo Editor

A browser-based tool for annotating climbing route topos. Load a photo of a crag, draw route lines pitch by pitch, assign French grades, and export the annotated image.

**Live app:** https://codmw44.github.io/climbing-topo-creator/

## Features

- Load any crag photo and draw route lines directly on it
- Multi-pitch support with per-pitch grade assignment (French grading system)
- Solid and dotted line styles (useful for hidden sections)
- Pitch station markers at belay anchors
- Route labels with name and grade overlay
- Zoom and pan the canvas
- Save/load projects as JSON (re-open the same image to restore)
- Export the annotated image as PNG
- Works offline (PWA)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `V` / `Escape` | Select mode |
| `D` | Draw mode |
| `Backspace` / `Delete` | Remove last point of selected pitch |
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Y` / `Cmd+Shift+Z` | Redo |

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Tech Stack

- React 18 + TypeScript
- Vite + vite-plugin-pwa
- SVG overlay for route drawing
- File System Access API for save/load
