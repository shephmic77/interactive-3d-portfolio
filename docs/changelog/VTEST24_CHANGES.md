# VTEST24 — a hilltop, and a fuller exterior and interior

Goal: push toward the stacked hilltop house from the reference ("small and compact, but looks full"), outside and in, without moving or removing anything that was already there.

## The hill (`src/world.ts`)
- The plaza now sits on a **stone-walled plateau**: a retaining wall all round (coping stone, courses, buttresses) and a **broad 12-step stone stair** down the front with low cheek walls.
- The ground **falls away** from the plaza (`terrainY`): a displaced grid with the painted grass. Every tuft, flower, tree and hill follows it; the far ground plane sits lower.
- A longer **sandy path** from the foot of the stair, stepping stones beside it, **rocks** (grey, some with a moss cap) and **shrubs** hugging the wall, two big trees behind the building.
- `KNOLL=false` restores the flat meadow.

## Building exterior
- **Timber corbels** under the terrace slab edge and the roof slab edge (only where nothing is mounted on the wall).
- **Tile cone roof** over the spiral-stair landing.
- **Weathervane** on the cabana ridge and a **wind chime** under its front plate.

## Interior (both floors, nothing existing moved)
- **Timber ceiling beams** matching the frame outside.
- **Swag lights** along the beams (fake glow only).
- **Hanging planters** with trailing vines in the front windows of both floors.
- **Wall shelves** with books, jars and plants, a **wall clock** over the bookshelf, two **framed prints** of an invented generic landscape, **paper lanterns** in the upper room's back corner, and a **striped runner** by the shop door.

## Verification (honest status)
- Stub-typed `tsc` passes. A real `npm run build` / Vercel deploy has **not** been run.
- Software renders at home, front, left, back, interior close-ups and phone width; hover and click still work.
- Draw calls ~1,040 → ~1,140, ~110k triangles (the hill grid is ~9k on desktop, ~4k on mobile). No new real lights.
- Not verified: real GPU framerate and phone performance. If a phone struggles, lower `HILL` detail (the `cell` size in `knoll`) first.
