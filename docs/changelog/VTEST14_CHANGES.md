# vtest14: three left-wall posters swapped for your 8-bit artwork, 20% smaller

Changed files: `src/world.ts`, and the three pictures in `public/posters/` (`battlefront2.jpg`, `xbalanque.jpg`, `joker.jpg`, replaced with the pixel-art versions you supplied, resized to 512 x 768).

- The three posters on the ground-floor left wall now show your new artwork: the Battlefront II poster, the jaguar warrior (Xbalanque) and the blue joker card.
- Each is **20% smaller** than before (heights 1.29 / 1.20 / 1.20 became 1.03 / 0.96 / 0.96) and all three are now 2:3 like your images, so nothing is stretched. Positions on the wall are unchanged.
- The code no longer pixelates these (`pix` is 0), because the new pictures are already pixel art; pixelating twice would have blurred them. The Kafka poster on the back wall is unchanged.

Not verified: no real `npm run build`, Vercel deploy or phone test; only the stub-typed `tsc` check and software-rendered screenshots (checked through the left window).
