# vtest21: performance pass for phones and laptops

Changed files: `src/world.ts`, `src/main.ts`. The picture is unchanged.

**Why:** a measurement of the scene showed about 3,400 separate meshes, so about 3,576 draw calls per frame, and the shadow map was redrawn every frame with about 1,700 more. That is a lot for a phone.

**What changed**
- All solid, opaque, non-interactive meshes are merged at start-up, by material, shadow flags and a 12-unit area of the scene. Draw calls per frame went from 3,576 to 905 (measured in a headless browser; triangles unchanged at about 68,000).
- Nothing that casts a shadow moves except the hover-scaled targets, so the shadow map is now drawn once, and again only while a target is scaling for hover.
- On small screens the shadow filter is the cheaper one. The existing phone settings stay: pixel ratio capped at 1.25, smaller shadow map, wider field of view.

**Not touched:** interactive groups (cart, corkboard, vending machine, resume stand, arcade), transparent glass and glow decals, sprites, the 12 real lights.

**Checked:** screenshots before and after at four camera positions differ by under 0.4 on average out of 255 (light flicker timing only). Hover and click still work on the book cart, vending machine and arcade, including the back-view occlusion.

Not verified: no real `npm run build`, Vercel deploy or phone test; only the stub-typed `tsc` check and software renders. Software rendering gives draw-call and triangle counts but not real frame rates, so please tell me how it feels on your phone.
