# vtest10: tidy-up from your review screenshots

Changed file: `src/world.ts`.

**Removed**
- The two tall street lamps on the right side of the plaza.
- Every lantern that stood on the paving (the four by the shop, the one in the right-hand corner, the one by the back bench, the one at the back).
- The standing lamp beside the couch in the right-hand corner (the rug, bench, poufs, side table lantern, books and candle stay).
- The bicycle.
- The tea set (teapot and two cups) on the roof table.
- Everything on the ground-floor counter (copper pot, snare drum, stapler, three cups and the zinc appliance). The counter is now bare.
- The playing cards and the two paperbacks on the upstairs coffee table. The candle stays.
- The tall name sign and its pole.

**Changed**
- **Bulb strings** now follow the plaza edge and turn at the corner posts instead of cutting diagonally to the building wall. Both sides run down the edges as before; each back run goes straight along the back edge from its corner post to a slim stake at the end of its hedge. The gap behind the vending machine and arcade cabinet stays open.
- The plush bear on the upstairs sofa is now a **generic stuffed tiger** of our own design: orange fur, dark stripes, cream muzzle, cheek ruffs and tummy, a ringed tail. It is not any specific character.

**Added**
- A **bracket lamp** on the left wall by the front corner, where the name sign used to stand, with a warm bloom and a pool of light on the paving. It is faked like the other lamps (no new real light).

## Verification
Type-checked with the stub-typed `tsc` (exit 0). Rendered close-ups in software WebGL of the string lights, the tiger, the corner lamp, the roof table and the empty counter. Not tested: the real Vite build, the Vercel deploy, phones, GPU frame rate.

## Notes
- The two slim stakes at the hedge ends are new, because a string needs something to hang from now that the tall posts are gone. Say so if you would rather end the strings another way.
- Removing the floor lanterns and street lamps makes the plaza darker away from the shop; the corner lantern posts, strings and shop windows still light it.
