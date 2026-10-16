# Interactive 3D Portfolio — Michael Shepherd

> 🚧 **Work in progress.** This site is still being built. Features, scenery and content change often, and parts of it are unfinished.

An interactive, night-time 3D portfolio. The building *is* the portfolio: you orbit a small street-corner studio and click objects in the scene to open each section.

Built with **TypeScript**, **Three.js** and **Vite**. All scenery is generated procedurally in code, so there are no model files to load.

## Sections

| Section | 3D object you click |
|---|---|
| Projects | Book cart |
| About me | Corkboard |
| Contacts | Vending machine (back of the building) |
| Resume | Resume stand |
| Credits | Arcade cabinet (back of the building) |

Controls: drag to orbit, scroll to zoom, click an object to select it, `Esc` to return to the main view.

## Run it locally

Requires [Node.js](https://nodejs.org/) 20.19 or newer (required by Vite 7).

```bash
npm install
npm run dev       # development server with hot reload
npm run build     # type-check, then production build into dist/
npm run preview   # serve the production build locally
```

## Project structure

```
.
├── index.html            # page shell and UI markup
├── public/               # static assets (favicon)
├── src/
│   ├── main.ts           # scene setup, camera, interaction, render loop
│   ├── world.ts          # the 3D building, props and lighting
│   ├── ui.ts             # panels, navigation and overlays
│   ├── content.ts        # text and links shown in the portfolio
│   └── style.css         # interface styling
├── docs/
│   └── changelog/        # notes for each iteration (V7 → VTEST24)
├── package.json
└── tsconfig.json
```

## Status and roadmap

Still under active development. Current focus areas:

- Polishing the exterior detail and the night-time lighting
- Checking for floating, clipping or cut-off objects
- Keeping the site responsive, accessible and fast
- Finishing and reviewing the content in each section

See [`docs/changelog/`](docs/changelog/) for what changed in each iteration.

## Tech

- [Three.js](https://threejs.org/) `0.180`
- TypeScript `~5.9`
- Vite `7`
