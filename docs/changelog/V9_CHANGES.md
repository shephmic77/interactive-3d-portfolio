# V9: compact building, no floating or clipping, flush machines, left terrace rail

Changed files: `src/world.ts`, `src/main.ts`. Everything else is unchanged from V8.

## Honest status
Nothing here was built with Vite or rendered in a browser (the package registry was not reachable in my workspace).
What was checked: a stub-typed `tsc` pass, and a Node harness that builds the real `world.ts` scene graph with a mock of
three.js (no WebGL) and runs geometric checks (below). **Brightness, the .78 composition, camera framing and the
interior furniture still need your eyes.** Run `npm run dev`, look, and tell me what is off.

## Smaller, more compact building
- The whole building is one group scaled by `BUILDING_SCALE = .78` (top of `world.ts`). Change it to resize everything
  (try .72 for tighter, .85 for roomier). Key lights attached to the building are repositioned and their intensity
  scaled by the square of the scale, so lighting levels stay about the same.
- Props that live in the world (book cart, neon signs, resume stand, name sign, plaza) are placed by constants
  (`CART`, `RESUME_STAND`, `NEON`, `NAME_SIGN`, `PLAZA`) and were pulled in close to the building.
- Home camera (`HOME_*` in `main.ts`) moved to distance 19.5 with a new target so the whole building and all the props
  fill the default isometric view. Section camera `views` were retuned for the smaller layout. Mobile uses x1.2 distance.

## Vending machine and arcade are flush to the wall
Both sit against the back wall (about 5 cm of clearance for the plinth, no gap), with their lights and signs re-seated.

## Missing railing added
The left side of the second-floor terrace now has a rail (plus the back-left return), matching the existing rails.

## Floating and clipping audit
I did not only fix the items you circled. I wrote a checker that finds every solid object not physically touching
anything that holds it up, and every object buried in a wall. Starting count: 225 unsupported pieces. Final: 0 at a
1.2 cm tolerance. Fixes include:
- Wall lamps and lamps by the door now sit on the wall plane with a back plate.
- Railing planters sit on top of the rail with saddle brackets (they used to straddle the bars).
- Awning lamp cords end exactly at the awning underside (no "pegs" through the fabric); awning back rail re-seated.
- The dark object at the lower-left base (pot plus pipe) is re-seated; pipes get wall clamps.
- Roof and terrace furniture that hovered ~10 cm above the floor now rests on it.
- String lights hang from poles; floating globes, a legless bench and side table got legs or supports.
- Cart wheels, books, resume-stand legs, door handle, pots, vines and rear HVAC units fixed; buried pots moved.
- Three fixtures in mid-air on the right side were removed or relocated.
The only remaining "clip" candidates are 10 HVAC bracket arms that are meant to go into the wall.

## Other checks run (harness, no rendering)
- Every window and door opening is see-through except the sash, blinds, dark glass and kick panels.
- 19 of the 21 hit targets are visible from the home camera. The vending machine and arcade are on the back, so they are
  hidden from the default view by design (reachable from their section cameras).
- 216 interior meshes all lie inside their room bounds.

## Tuning
`BUILDING_SCALE`, `PLAZA`, `CART`, `RESUME_STAND`, `NEON`, `NAME_SIGN` in `world.ts`; `HOME_*` and `views` in `main.ts`.
Git was not touched.
