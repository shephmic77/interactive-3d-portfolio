# V1: book shop, first build

A real interactive, procedural **TypeScript + Three.js** portfolio, inspired by the *type of experience* we designed together: a compact, densely detailed isometric exterior building with neon signage and discoverable objects. It is **not** a reproduction of Jesse Zhou's ramen shop or a static image pretending to be 3D.

## Quick start

Install Node.js LTS (22+ recommended) and open this folder in VS Code.

```bash
npm install
npm run dev
```

Open the `http://localhost:5173/` URL from the terminal.

### Production build

```bash
npm run build
npm run preview
```

To publish, deploy the generated `dist/` folder to Netlify, Vercel, GitHub Pages, or another static web host. For GitHub Pages under a repository subpath, configure `base` in `vite.config.ts` or use your own domain at root.

## Controls

- **Mouse:** drag to rotate the building, scroll to zoom, click signposts and physical objects.
- **Touch:** swipe to rotate, pinch to zoom, tap signs or objects.
- **Keyboard:** tab through the HTML navigation, Enter to select, Escape to return to the home view.
- **Back button:** navigates across visited hash sections.
- The site also has a clickable accessible menu if WebGL fails or the objects are too small to select.

## Physical navigation map

| Menu | 3D location | Behavior |
|---|---|---|
| Projects | book cart outside the storefront | 11 selectable volumes, filterable by category |
| About me | corkboard on the right side | background, education and interests |
| Contacts | vending machine at the back | real email / GitHub / LinkedIn links |
| Resume | document stand by the entrance | readable HTML summary and Print / Save PDF |
| Credits | arcade cabinet beside the vending machine, at the back | credits for code / site |

The *Engineering Portfolio* is **one book**, grouping older CAD projects. The other books represent seven data-science projects, two AI/software projects, and one hardware project. FutWAR is labeled "In progress".

## Customize

- **`src/content.ts`**: name, bio facts, 11 project volumes, descriptions, project links, contact URLs, and colors.
- **`src/ui.ts`**: content shown when someone clicks each menu section, panel designs, and interactions.
- **`src/world.ts`**: all 3D meshes, environment, book cart, signposts, machines, procedural textures, lighting, and props.
- **`src/main.ts`**: camera angles, transitions, keyboard, mouse, touch, and navigation.
- **`src/style.css`**: typography, HTML controls, responsiveness, panel styling.

### Resume PDF

No original resume PDF was supplied in this website-generation request. The Resume area therefore uses an **editable HTML summary** with a functioning Print / Save as PDF button; it does **not** pretend that this summary is the user's official resume. To offer the actual resume, place your PDF in `public/resume.pdf` and change the resume button in `src/ui.ts` to link to `/resume.pdf` (adjust for subpath hosting).

### 3D art

The building is authored from geometric meshes and Canvas textures. It looks like a **stylized interactive prototype**, not an asset-for-asset recreation of the concept illustration. For production art closer to the illustration, replace the procedural components with optimized Blender exports (`.glb`/`.gltf`) and baked textures. You can keep the existing UI / navigation layer and object placement logic.

### Crediting third-party assets

The current implementation contains no downloaded 3D models or copyright-protected poster images. If you later add commercial music, fonts, icons, photos, models, or textures, verify the licenses and update the arcade Credits section accordingly. The fonts use Google Fonts and fall back to system fonts if offline.

## Troubleshooting

- `npm is not recognized`: install Node.js and restart VS Code.
- Black screen: check browser WebGL support and DevTools console, update graphics drivers; the HTML navigation will still work.
- Low frame rate: lower `renderer.setPixelRatio` in `src/main.ts`, then disable `renderer.shadowMap.enabled` if needed.
- Mobile: use the **EXPLORE** button in the bottom-right for a larger menu.
- To navigate direct to a section: append `#projects`, `#about`, `#contact`, `#resume`, or `#credits` to the URL.

**Status:** Complete, editable front-end site with project browsing and functioning navigation. No contact form submissions, private database, or backend are included because email/LinkedIn/GitHub are used for contact.
