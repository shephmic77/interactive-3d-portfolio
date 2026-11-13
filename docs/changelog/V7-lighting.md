# V7 (Pass 1): lighting and performance

Changed files: `src/world.ts`, `src/main.ts`. Everything else is unchanged from V6.1.

## Lighting
- Real point lights cut from ~56 to 14. Lamps now use emissive bulbs + additive halos + light-pool decals
  (`halo()`, `glowPatch()` in `world.ts`). Do not add PointLights to individual fixtures; budget is `POINT_LIGHT_BUDGET` (16).
- Added a cool rim light from the right and warm bounce gradients on the lower walls.
- Lit windows spill light onto trim and the ground in front of them.
- Light animation uses each light's configured intensity (no hardcoded base values).
- Live tuning without editing code: open the site with `?glow=1.3&keys=0.9`
  (`glow` scales halos/pools, `keys` scales real lights; 1 = as authored).

## Performance
- Window interiors share 3 textures (+1 door texture) instead of one canvas per window; sign lettering texture shared by both faces.
- Shadow map is 1024 on small screens (2048 otherwise).

## Camera
- Default view ~12% closer, aimed slightly lower, shifted right to clear the intro text. Mobile framing unchanged.

## Not verified
Not built or rendered by the author (npm registry unavailable in the authoring environment). Run `npm install && npm run build`,
then check brightness in the browser and tune with `?glow=` / `?keys=`.

## Known issues (not changed)
Floating pieces: HVAC at (4.39, 5.70, -1.86); sconces at (4.43, 5.96, -0.96), (4.37, 5.84, 0.32), and two at y=8.22 above the roof;
terrace lantern at (1.56, 5.66, 0.79) sits inside the upper wall.
