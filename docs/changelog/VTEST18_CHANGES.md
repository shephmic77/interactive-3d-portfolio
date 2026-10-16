# vtest18: poster shimmer fix, more detailed climbing wall

Changed file: `src/world.ts`.

**Poster shimmer (the Battlefront / Anakin poster, and the other wall pictures)**
- Cause: the picture sat only 0.5 mm in front of its frame, and the frame's back sat exactly on the wall, so the depth buffer flickered between them while the camera moved.
- Fix (in `imagePoster`, so it applies to every framed picture): thicker frame lifted slightly off the wall, picture floated 12 mm in front of the frame, plus a depth offset on the picture.

**Climbing wall, still low-poly**
- The panel face is now one painted-texture canvas: four section tints, paint speckle, a T-nut hole every 20 cm, edge and seam screws, and height marks ("2 m", "4 m", "6 m").
- Holds are faceted rock-like polygons (jugs, slopers, crimps, pinches, foot chips) with a bolt in the middle and a soft contact shadow, and they sit on the T-nut grid.
- The two volumes are now truncated pyramids with bolts.
- Added a pink problem down the left edge next to the coral route and the cyan problem; grade tags (V3, V5, V4) at the starts; four quickdraws on bolt hangers; two steel anchor plates with rap rings at the top-out; and a chalk bucket on the crash pad.
- Kept: the panel, standoffs, route shapes and colours, the monkey, the lamps, the pad and the shoes.

Not verified: no real `npm run build`, Vercel deploy or phone test; only the stub-typed `tsc` check and software renders. The wall was checked in renders. The poster fix follows from the cause above; software rendering cannot reproduce the drag shimmer, so please check it on your device.
