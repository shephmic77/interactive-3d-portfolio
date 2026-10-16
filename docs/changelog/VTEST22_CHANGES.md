# VTEST22 — Ghibli / Porco Rosso surroundings

Goal: move the world around the building toward the Studio Ghibli look (Porco Rosso as the north star) without touching the building, its interiors, the five nav interactions or the personal items.

## What changed (`src/world.ts`)
- **Painted night sky:** gradient dome, two star layers, a moon, and two slowly drifting painted cloud bands.
- **Meadow:** grass-textured ground, rolling low-poly hills, 15 round-canopy trees placed 23+ units out so they frame the building from every orbit angle instead of blocking it, ~260 grass tufts and flowers on desktop (150 on mobile) kept outside the plaza.
- **Sandy path** winding from the front curb toward the viewer.
- **Wind:** leaves on the existing plants and trees sway gently (vertex shader, no extra lights). Disabled by the reduced-motion path in `ghibliWorld`.
- **Fireflies:** 64 on desktop, 36 on mobile, additive points.
- Fog colour shifted slightly teal. No new PointLights.
- One switch, `GHIBLI_SURROUNDINGS`, turns the whole pass off.

## `src/main.ts`
No change this iteration (shadow-map changes were VTEST21).

## Verification (honest status)
- Stub-typed `tsc` passes. A real `npm run build` / Vercel deploy has **not** been run.
- Software renders checked at front, back, low and side camera angles and at phone width; the building stays clearly visible.
- Hover and click still work (resume stand, book cart and corkboard hit-tested).
- Draw calls: ~905 → ~1010 (trees are not merged yet). Triangles ~86k.
- Not verified: real GPU framerate, real phone performance, reduced-motion behaviour.
