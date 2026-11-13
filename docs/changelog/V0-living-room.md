# V0: living room prototypes

The first concept, before the book shop: two living-room prototypes.

## Prototype


An intentionally basic TypeScript + Three.js room prototype. All geometry is temporary; no generated reference image is used as a texture. This is not the final design.

### Prerequisites
- Node.js LTS
- VS Code (recommended)

### Run
```bash
npm install
npm run dev
```
Open the local URL shown by Vite (normally http://localhost:5173).

### Controls
- Drag to rotate the camera a little
- Scroll to zoom
- Click a media case or device to see its category

### Build
```bash
npm run build
```

### Current structure
- Left shelf: 2 VHS tapes, 7 Xbox game cases, Xbox console
- Center: CRT television, VCR
- Right shelf: record player, 8 record sleeves, Wii console, 1 Wii case
- Basic room and coffee table, simple lighting

No detailed decorative models or project pages have been implemented. The case labels identify only categories. All future design decisions remain open.

## Prototype v2


TypeScript + Three.js + Vite. This is an **actual interactive 3D scene**, not a single background image.
The CRT screen and three framed posters use textures cropped from the supplied reference image; the furniture, room, lamps, media, collectibles, and camera are made with Three.js.

### Run in Visual Studio Code

1. Install Node.js LTS and Visual Studio Code.
2. Extract this folder, then open it in VS Code.
3. Open a terminal in the folder and run:

```bash
npm install
npm run dev
```

4. Open the URL shown by Vite (usually http://localhost:5173).

### Controls

- Drag: look around slightly.
- Scroll: zoom.
- Click project cases, records, and devices to see their label.

### Design intent

This is a **prototype approximation** of the reference, not a final 3D model. The room includes the CRT, raised VCR stand, two consoles, a turntable, left window, framed Rose/Phantom Menace/Random Access Memories posters, Juventus scarf, clone helmet, Ichiro bobblehead, stylized Snorlax chalk bag, plants, lamps, couch and empty coffee table.

The existing media inventory is preserved: **7 Xbox game cases (data science), 2 VHS (software/AI), 1 Wii case (Pluto12), and 8 vinyl records (mechanical engineering)**. Only the specified projects appear; covers are still placeholders.

### Next steps (not implemented)

Project-specific cover art, accurate modeled props, custom camera transitions, and individual project pages are intentionally not included until you decide to work on them.

### Build

```bash
npm run build
```
