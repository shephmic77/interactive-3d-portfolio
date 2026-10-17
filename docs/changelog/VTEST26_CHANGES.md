# VTEST26 — the concept massing (W1), then a smaller ground floor

Feedback: the VTEST25 retrofit was "not like the mock-up", so the building was rebuilt to match the chosen W1 concept; then "too big, more compact and smaller, start with the first floor".

## New massing (`MASSING`, `src/world.ts`)
- A narrower, gabled upper block (teal tile roof, timber frame, chimney) stacked on the ground floor, with a round plaster tower beside it capped by a blunt teal cone and weathervane.
- The roof deck is an open terrace with a cantilevered balcony on two posts, a planted terrace garden, table and chairs. The old oriel bay, tile porch and carport are gone.
- Two small planted lean-tos stand against the side walls: a right annex with a flat garden roof, red awning, ladder and bicycle, and a left annex with a teal hip roof and yellow awning.
- Teal roof tiles, peach plaster. The climbing wall, jerseys, posters, record frames, shelves and all other personal items were moved into the narrower upper block, not removed.

## Smaller ground floor
- The building group is scaled by 0.8 in plan (x and z) and 0.93 in height (`PLAN`, `HEIGHT`). It is a squash of the whole building, because the upper volumes sit on the ground floor. The ground floor is now about 6.8 x 4.9 m.
- World-space props follow through a `pull(x,z)` helper: book cart, resume stand, neon sign, plaza, kei truck, heron, hedges, troughs, bench, crates, couch and the lamp posts. Both annexes are drawn at 0.85 size and tucked against the new walls.
- The planted hut on the right annex roof was dropped: from the home camera it hid the corkboard.
- Home camera pulled in (distance 21.5), mobile home view tightened, and the five section views re-aimed at the moved targets. The About view now looks at the board straight on, so the annex is out of the way.

## Verification (honest status)
- Stub-typed `tsc` passes (it checks syntax and scope, not three.js API use). A real `npm run build` / Vercel deploy has **not** been run.
- Software renders at home, right, left, back, all five section views and a phone-width portrait.
- Hover test from 7 cameras: every target that was reachable in VTEST25 still is; the corkboard from the home camera was briefly blocked and is fixed. Performance counters: 1,150 draw calls, 103k triangles, 12 point lights (VTEST25: about 1,152 / 105k / 12).
- Not verified: real GPU framerate, phone performance, and whether the 20% plan squash makes text and posters look stretched on a real screen (they looked fine in renders).
