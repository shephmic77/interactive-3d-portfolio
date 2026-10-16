# vtest9: three supplied pictures

Changed files: `src/world.ts`, `public/albums/skydive.jpg`, `public/albums/red-pool.jpg`, `public/posters/desert-poster.jpg`.

- The upstairs picture grid on the right wall is now **2 wide x 3 tall**. The two supplied pictures (a skydiver over an island, a red pool by the sea) are the new top row, above the four record sleeves.
- The third supplied picture (a desert poster) hangs on the **ground-floor back wall**, to the right of the Baggio poster, visible through the right-hand shop window.
- All three pictures were resized (512 px squares, 512 x 697 for the poster) and are loaded as ordinary image files, so they can be swapped by replacing the file with the same name. Until an image loads, a flat colour shows.
- The two new frames have no title text. Send titles if you want a plaque on them.

## Verification
Type-checked with the stub-typed `tsc` (exit 0). Rendered close-ups of the grid and the poster over a local http server in software WebGL. Not tested: the real Vite build, the Vercel deploy, phones.

## Note
Two of the pictures show familiar third-party artwork (a well-known album look and a film title), supplied by the site owner. That is fine for a personal site you control, but a public page can attract takedown requests; swap them for your own images if that worries you.
