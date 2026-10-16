# vtest8: a cosier courtyard

Changed files: `src/world.ts` (one new "COZY PASS" block, plus small edits to the paving, name sign and dark windows).

## Removed
- The four tall black corner bollards and the row of black bars at the front edge of the paving (drain-grate look); both read as stray glitches.
- The empty, unlit panel on the blade sign: it now carries the name in two columns of warm lettering on both faces.
- The two "unlit" windows (left wall, upper back wall) no longer look abandoned: dim warm glass, curtains, a lamp glow and two sill pots.

## Added (all world-level pieces in world units, building pieces in building units)
- **Corner lantern posts** with a light pool under each, and **bulb strings** along both sides and, as two diagonals, from the back posts to the side walls. They stay clear of the vending machine and arcade cabinet; the shop front is left open.
- **Low hedges** along the sides and back (gaps for the truck, the heron and the machines), with a few fairy bulbs tucked in.
- **Flower troughs** along the front curb, **ground lanterns** by the door, shop crates and back corner, **candle jars** on the shop-front crates.
- **A reading corner** on the right: round rug, bench with cushions and blanket, poufs, side table with lantern, book stack and candle, a floor lamp with a light pool, a plant.
- **A bicycle** with a flower basket leaning on the right hedge, a **back bench** with lantern and a plant crate corner.
- **Ivy** on the left wall, back wall and upper back wall.

## Lighting
No new PointLights (the budget in `world.ts` is unchanged). Every new light is an emissive mesh with a halo and a flat pool decal on the ground. Roughly 70 extra halo sprites; cheap, but if a low-end phone struggles, remove the `festoon(...)` calls first.

## Notes
- The cozy pass runs after everything else and uses its own random generator, so the seeded plant and paving layout from earlier versions is unchanged.
- Nothing from the "not implemented" list in ENDGAME_ONLY (characters, crests, branded items) was added; everything new is generic.

## Verification
Type-checked with the stub-typed `tsc` (exit 0). Rendered in software WebGL from home, left, back and the Contact and Credits views. Not tested: real GPU frame rate, phones, the real Vite build, the Vercel deploy.
