# V8: polish pass (hollow building, picking, signs)

Changed files: `src/world.ts`, `src/main.ts`. Everything else is unchanged from V7.

## Fixes from your V7 review
- **Hover through walls.** Hover/click now ignores any object hidden behind a wall. After a pointer ray finds a target
  (vending machine, arcade, etc.), a second ray checks for solid meshes in front of it (`World.occluders`, built from every
  visible solid mesh; invisible hit boxes and see-through glow decals are excluded). A target counts as hovered only if
  nothing solid is in front of it. Targets still win against their own meshes.
- **Bright blue-white blob.** The ground was glossy (metalness .35, roughness .30), so every point light left a huge
  specular hot spot on it. It is now matte (metalness 0, roughness 1).
- **Stretched text.** "ABOUT ME" label, "THE LITTLE STUDIO" and the "PROJECTS / THE BOOK CART" banner were drawn on
  textures with a different aspect ratio than the planes that show them. Textures now match their planes. The label font
  also shrinks to fit short textures.
- **Corkboard.** Glow decal removed. A lamp fixture is mounted beside the board (right wall, z = -1.05) and the corkboard
  key light is much weaker (3.2 -> 1.7), so the notes stay readable instead of glowing.
- **Name sign.** Now an empty dark panel with a slim lit border, hung from a pole and arm (it used to float). Everything
  about it is in one object, `NAME_SIGN`, near `nameSign()` in `world.ts` (x/y/z, rotY, w/h, thickness, pole position,
  border colour). Change `w`/`h` for a different shape.

## Hollow building (no more picture windows)
- Both floors are real rooms. `hollowWall()` builds each wall as an outer brick slab plus an inner plaster layer, cut
  around every window/door opening (openings are registered by `facadeWindow()` and `doorway()`).
- Windows are real openings with a reveal (wall thickness), a casing, a slim sash and a sill, no textures. Dark windows
  have a dark glass pane set back in the hole; blinds hang inside.
- Both doors (shop entrance and terrace door) are real doorways with glazed leaves. The terrace door now sits just above
  the tile level instead of floating ~15 cm above it.
- Floors and ceilings: wood floors, plaster ceilings. Brick joint lines are no longer drawn across windows.
- Simple furnishings (`interiors()`): ground floor with a counter below the rear window, bookshelf, table with stools, rug,
  plant and three pendant lamps; upper floor with a sofa, bookshelf, rug with low table, floor lamp, pendant and a plant.
  Nothing from ENDGAME_ONLY.md is used.
- Interior brightness: room surfaces glow gently (emissive). New tuning knob `?room=` (1 = as authored), for example
  `?room=1.4` brighter rooms, `?room=0.6` dimmer.
- Trailing plant vines on the terraces/roof are stopped at the floor so they no longer hang through the slab into the rooms.
- The terrace lantern that sat inside the upper wall now hangs on a small bracket just outside it.

## Tuning knobs (URL)
`?glow=` halos/light pools, `?keys=` real lights, `?room=` interior glow. All 1 = as authored.

## Checks that were run, and what they cover
- `tsc` strict type-check against a loose stub of three.js (real `three` types could not be installed): syntax and
  the project's own types only.
- `buildWorld()` was run in Node against a small mock scene graph (not WebGL) to check geometry numerically:
  14 real point lights; every window/door opening is see-through except for its sash, blinds, kick panel or dark glass;
  no wall piece rises above its wall; 216 interior meshes stay within the room bounds; from the default camera the vending
  machine and arcade are hidden behind the building, while the book cart, books, signs, corkboard and resume stand are reachable.

## NOT verified
Not built with Vite and not rendered: the author's environment cannot reach the npm registry, so three.js and Vite could
not be installed. Brightness, colour and exact placement of interior furniture still need your eyes.
Run `npm install && npm run dev`, then tune with `?glow=`, `?keys=`, `?room=`.

## Known issues (not changed)
Floating pieces: HVAC at (4.39, 5.70, -1.86); sconces at (4.43, 5.96, -0.96), (4.37, 5.84, 0.32), and two at y=8.22 above
the roof. A planter at (3.95, 0.2, -0.96) is now inside the ground-floor room, next to the right wall.
