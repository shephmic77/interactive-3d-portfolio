# vtest17: terrace-rug nook restyle, dimmer interior, tile flicker fix, clearer terrace and roof

Changed file: `src/world.ts`.

**Reading nook**
- The rug is now a round terracotta and cream swirl, drawn to match the reference image you sent.
- The armchair is light brown (camel velvet) to match the rug.

**Dimmer, warmer interior**
- Indoor plaster, ceiling and floor fill is lower, and the interior-facing key lights are weaker, so the rooms read as lit by their lamps instead of evenly.
- Lamp pools, halos and wall washes are kept and slightly stronger, so each lamp visibly lights the surfaces near it. No new PointLights.

**Terrace tile flicker (when dragging)**
- Cause: the glow decals lay coplanar with the tile tops and fought them in the depth buffer (z-fighting).
- Fix: the decals have polygon offset and a tiny lift above the tiles, and the seam strips sit slightly higher.

**Terrace and roof clearance**
- The lounge chair moved from the stair landing to the back side of the little table; the stair arrival, the terrace door and the walkway are clear.
- The roof lantern post that stood in the climbers' exit is gone. A small lantern now sits on the back rail beside the opening (with its halo and a warm pool on the roof).
- Potted plants standing on the floor were removed: two at the entrance, four on the terrace, three on the roof, the roof corner pot, and the ones around the building and at the back.
- Kept: the planters that hang on the railings, the pots on window sills, the indoor plants and the crate-mounted pot. If you want those gone too, say so.
- The removed pots are replaced by a `skipPot()` helper that consumes the same seeded random numbers, so nothing else in the scene moved.

Not verified: no real `npm run build`, Vercel deploy or phone test; only the stub-typed `tsc` check and software-rendered screenshots. The tile flicker fix is from the cause above; software rendering cannot reproduce drag flicker, so please check it on your device.
