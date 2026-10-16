# VTEST23 — the building itself: timber frame, tile roofs, chimney

Goal: move the building toward the stacked timber-frame hilltop house from the reference picture ("small and compact, but looks full") without removing or moving anything that was already on it.

## What changed (`src/world.ts`)
- **Walls:** warm plaster over a stone plinth instead of dark brick. The brick joint lines are off on plaster.
- **Timber frame:** dark oak corner posts, rails along the sill, lintel and top plate, posts on a regular grid and diagonal braces in clear panels, on both floors. Every beam is cut wherever it would cross a window, door, lamp, vent, pipe, ivy, the hoop, the corkboard, the machines or the climbing wall (see `WALL_ITEMS`).
- **Window and door headers:** a heavy timber lintel above every opening and a slim sill below it.
- **Rooftop cabana:** an open timber cabana with a terracotta gable roof on the left of the roof terrace (posts, plates, tie beams, rafters, knee braces, a hanging lamp). The table, chairs, tank, antenna and lanterns stay in the open.
- **Tile hood** over the second-floor terrace door.
- **Brick chimney** on the right terrace beside the door, rising past the roof with corbelled cap and two flue pots, plus a slow thread of smoke (still when reduced motion is on).
- One switch, `TIMBER_FRAME`, restores the old brick look.

## Verification (honest status)
- Stub-typed `tsc` passes. A real `npm run build` / Vercel deploy has **not** been run.
- Software renders at the home view, front, left, back, right, close-ups and phone width. Hover and click still work on the resume stand, book cart and corkboard.
- Draw calls ~1,010 → ~1,040; ~87k triangles. No new real lights.
- Not verified: real GPU framerate, real phone performance, smoke on a low-end device.

## Not done yet (ideas from the reference)
Raised grassy knoll under the plaza, rocks along the path, shutters, tile eaves on the ground floor sides, a bigger roof over more of the roof terrace (would mean moving roof items).
