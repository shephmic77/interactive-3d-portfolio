# vtest15: left wall as a 2 x 2 picture grid with a little table underneath

Changed files: `src/world.ts`, and one new picture `public/posters/kafka-8bit.jpg` (the pixel-art Franz Kafka you supplied, resized to 512 x 768).

- The ground-floor left wall is now a tidy **2 x 2 grid** of your four 8-bit pictures: Battlefront II and the jaguar warrior on top, the joker card and the Kafka portrait below. They are all 2:3 and a little smaller (0.56 x 0.84, with 0.10 between frames) so the block fits.
- A **little wooden side table** (lower shelf, a candle on top) stands under the grid. To make room, the workbench, the table, the chest and the plant are re-spaced along the wall in that order (workbench and chest each moved slightly, the plant moved about 0.25 toward the front).
- The Kafka picture on the back wall above the counter was **left as it was** (it is a different, older picture). Say if you want it removed or swapped for the new one.
- "4x4" was read as four pictures in a 2 x 2 grid. A true 4 x 4 would be sixteen frames; more pictures can go in the same way.

Not verified: no real `npm run build`, Vercel deploy or phone test; only the stub-typed `tsc` check and software-rendered screenshots (checked through the left window).
