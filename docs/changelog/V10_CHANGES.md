# V10: seating that faces the tables, clean plants, bouldering route, polish pass

Changed files: `src/world.ts` only. `main.ts`, `ui.ts`, `content.ts`, `style.css`, `index.html`, `package.json` and
`tsconfig.json` are unchanged from V9. All five nav sections and their 3D interactions are untouched.

## Honest status
This round I could finally look at the scene. I cloned the real three.js r180 source, bundled the real `world.ts`
with esbuild and rendered it in headless Chromium (software GL, SwiftShader) from many angles, including your home
views at desktop and mobile size. That is **not your Vite dev server and not a real GPU**, so brightness and bloom of
glow can differ a little on your screen. Type-checking was a stubbed `tsc` (not the real `@types/three`), so run
`npm run dev` / `npm run build` once and tell me about anything that errors or looks off.

## What you reported
- **Chairs faced away from tables.** Every seat is now placed with `faceTo(x,z,tx,tz)` and points at its table: roof
  set, terrace sets, the ground-floor waiting chair. Chairs, benches and side tables were rebuilt with legs, backrests
  and rails so nothing floats.
- **Glitchy plants.** The old plants (spiky overlapping shapes) were replaced with clean low-poly pots: clay pot, soil,
  a few flat-shaded blobs (bush or tall variant). Window-box planters and ivy were rebuilt the same way (ivy now uses
  simple octahedron leaves on a stem that follows the wall).
- **Ladder in the back replaced with a bouldering route.** A small lit climbing panel with a T-nut hole grid, a coral
  route, a cyan route, a violet volume, chalk marks, a crash pad and a bench. No ladder remains.
- **Stick in the middle of the doors.** The glazing bar in `doorway()` was removed.
- **Floating / clipping circled in your screenshots.**
  - Roof tank: now stands on legs with the rest of the equipment; antenna is attached to the HVAC cabinet.
  - Terrace pot at the corner was .015 above the tiles; now rests on them.
  - Orange vertical lines at wall corners were the glowing inner plaster layer peeking past the outer wall ends; the
    plaster is inset so only the intended glow remains.
  - Awning: removed brass plates/struts that poked through the fabric, window lintels that showed above it, and moved
    the shop sign (it floated 14 cm off the wall) onto the awning valance.
  - Removed a floating conduit, a floating blue cabinet and the old back bench.

## Things I found myself
- Terrace railing balusters poked a few millimetres through the slab edge and showed as small spikes on the fascia.
  They now start at the slab top (`foot` parameter of `perimeterRail`).
- Upper-right HVAC unit re-seated at the right height; pots that sat inside tiles were moved.
- Several glow decals, lamp backs and sign plates re-seated against the wall.

## Checks run
- Strict support audit (every solid must be held by something): 0 unsupported pieces at 1.2 cm.
- Clip audit: 11 candidates left. 10 are the HVAC bracket arms that are meant to go into the wall, 1 is a false
  positive from the bounding box of the violet climbing volume.
- Every clickable object still has a visible hit point from the intended views; the vending machine and arcade are
  (by design) not clickable from the front, where the building hides them. No interior mesh is outside its room.
- Rendered inspection (real three r180, headless): home desktop and mobile, front, awning, both terraces, roof from
  four sides, all four sides of the building, back, bouldering route, resume stand, book cart, signs, low street-level
  angles, top-down, rail close-ups.

## Known limits / ideas
- Glow decals near wall and terrace edges can extend a few centimetres past them. Judged nearly invisible; I left them.
- The home view on a phone is smaller than desktop but fully framed. A closer mobile framing could crop the signs.
- Not added: anything from ENDGAME_ONLY.md.
