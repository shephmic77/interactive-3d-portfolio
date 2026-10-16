# VTEST25 — a building with real massing, a calmer background, stylised interiors

Feedback from VTEST24: the hill and stair were too much; the building should have the irregular, stepped shape of the hilltop-house reference (the red-marked volumes), not stacked boxes; and the inside should be more stylised.

## Background scaled back (`src/world.ts`)
- `KNOLL=false`: the stone-walled plateau, the 12-step stair, the rocks and the long path are off (the flat meadow, sky, hills and fireflies from VTEST22 stay). The two big extra trees behind the building are removed.

## New building volumes (`MASSING`, all in `world.ts`, none of the existing items moved)
- **Right: tile porch roof.** A deep tile roof over the back half of the side terrace, sloping down from the upper wall to timber posts with knee braces, a plank soffit, rafters, a stone foot per post and two hanging lamps. It replaces the small door hood. The bench, side table, chair and the terrace door now sit under it.
- **Upper left: oriel bay.** A jettied box bursting out of the upper-left wall over the ground floor, carried on corbels, with a lit window grid (timber mullions), a flower box and a steep hip roof with a finial. The left terrace rail opens where it stands.
- **Lower left: carport.** A lean-to tile roof running from the ground-floor wall out over the parked kei truck, on three timber posts outside the truck, with a string of lights under the beam. (The truck is placed in world space while the building group is scaled .78, so the carport is sized in building units to clear it.)
- The timber frame skips these zones (`WALL_ITEMS`), so no beam crosses a roof. `MASSING=false` removes all three.

## Stylised interiors (`STYLE_INTERIOR`)
- **Walls:** sage beadboard wainscot with a chair rail and skirting under a warm hand-painted floral paper, on every inner wall of both floors (UVs are in metres, so the pattern never stretches).
- **Curtains** with tie-backs, rod, finials and a scalloped valance on the upstairs and side windows (not on the shop display windows, the slatted-blind windows or doors).
- **Pennant bunting** along the ceilings and **dried herb bundles** hanging from the beams.

## Verification (honest status)
- Stub-typed `tsc` passes (the stub types make three.js classes `any`, so it checks syntax and scope, not three.js API use). A real `npm run build` / Vercel deploy has **not** been run.
- Software renders at home, front, left, right, back, top, close-ups and phone width. Hover and click were tested against every interactive object from several cameras (see the table in the chat) and compared with VTEST24.
- Not verified: real GPU framerate and phone performance.
