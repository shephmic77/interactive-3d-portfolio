# vtest12: stair to the second floor, courtyard and indoor additions, terrace fixes

Changed files: `src/world.ts`, `src/ui.ts`, and four new pictures in `public/posters/`
(`kafka.jpg`, `battlefront2.jpg`, `xbalanque.jpg`, `joker.jpg`, all supplied by you).

**Getting upstairs**
- A **spiral stair** on the right side of the building, from the courtyard up to the side terrace (16 equal risers, one turn, hand rail and mid rail, a small lantern on the pole). It arrives through a gap in the terrace's right rail; the existing terrace door then leads into the second floor. There is still no stair *inside* the building (it would need a hole in the ground-floor ceiling).

**Terrace fixes**
- **Tiles:** the front strip and the right-hand terrace now share one tile lattice and one colour rule, so the lighter tiles run across the join (before, the two areas sat on different grids and only one had the lighter tiles).
- **Bulb string:** now a right angle, three posts and two runs that follow the front and right rails, instead of one diagonal across the corner.
- **Roof:** the bulb string and its two poles are removed.

**Lights (fake lights only: halo + floor/wall decals, no new PointLights)**
- Two lantern posts on the roof terrace (back-left near the climbers' exit, and behind the water tank), one lantern post at the left end of the first terrace, and a wall lamp at the back end of the upper right-hand wall.
- The corner lamp from vtest10 moved up to the blank second-floor wall you circled.

**Outside**
- A brown **tufted couch** on slim metal legs with a plain low-poly **raccoon** sitting on it and a **blue jay** perched on the backrest. Placed with its back against the right wall under the corkboard, facing out.
- Removed again at your request in the same session: the cardboard surfer-rooster standee, the sleeping bear, the hanging bistro sign, and the whole rug-bench-pouf lounge area on the right of the courtyard (the lounge and the first couch spot are gone; the code is in git history).
- The ivy on the back wall moved from the back window's frame to the wall above the credits cabinet (it was clipping the window).

**Inside**
- Four pictures from you as posters, pixelated for an 8-bit look: three on the ground-floor left wall (Battlefront II cover, Xbalanque, Balatro joker card) and one on the back wall above the counter (Kafka).
- A **ship in a bottle** (dark-sailed galleon) lying in a wooden cradle on the second-floor coffee table.
- A chunky wooden **workbench** and a **storage chest** along the ground-floor left wall.

**Credits panel**
- New "Inspiration" row: **Jesse Zhou**, "Inspiration for this project".

## Verification
Type-checked with the stub-typed `tsc` (exit 0). Rendered from several cameras in software WebGL (stair, couch and animals, bear, standee, sign, lamps, terrace, posters, workbench). Not tested: the real Vite build, the Vercel deploy, phones, GPU frame rate.

## Notes
- Where a request named a specific character, logo or brand artwork, generic stand-ins were built instead (workbench and chest, dark-sailed galleon); the posters are your own image files.
