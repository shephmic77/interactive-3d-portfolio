# vtest2: flag, monkey and TV fixed, plus a second round of END GAME items

Changed file: `src/world.ts` only. Everything else is identical to `vtest`.

## Honest status
Checked the same way as before: the real `world.ts` was rendered with real three.js r180 in headless Chromium (software GL),
and run through my floating-part audit, clip audit, interior-bounds check and a stub-typed `tsc`. It was **not** built with
your Vite install or seen on a GPU. Run `npm run dev` and tell me what still looks off.

## The three things you flagged
- **Flag cut in half**: it was two planes at different angles. It is now one continuous cloth (a single subdivided plane,
  hoist edge clamped to the mast with two brass clamps, gentle ripple away from the mast). No seam anywhere.
- **Monkey limbs not connecting**: the arms and legs started outside the torso. Every limb now starts inside the body
  (shoulder and hip balls overlap the torso), has an elbow or knee ball, and ends with a hand or foot pressed into its hold.
  The torso sits 4 cm off the panel so the animal reads as one connected body. Foot chips are kept clear of its back.
- **TV floating**: it overhung the bookshelf by most of its width. It now stands entirely inside the top board of a proper
  counter-height shop-display cabinet in the right window (so it shows above the sill), with rabbit-ear antennae, two generic
  consoles, a clamshell handheld and a gamepad beside it. The toy plane's cords are now thicker and pale so it reads as hanging.
- Also moved: the basketball hoop. It stood in front of the About Me board from the right-hand view. It is now in the
  front-right corner.

## New items (all original, generic, no characters, logos, crests or covers)
| Idea from your list | What is in the scene |
|---|---|
| Blue Prince | a blueprint-style floor-plan poster |
| Surf's Up | a sunset-wave poster (plus the surfboard from before) |
| Vinland Saga | a longship-at-dusk poster; three round shields on the front terrace rail, like a ship's side |
| Smite / Guatemala | a stepped jungle-temple poster |
| Knives Out / Memories of Murder / Monster | a "whodunit" poster: magnifier, question mark, footprints |
| Fantastic Mr. Fox | a geometric fox poster and a small orange fox figurine |
| Pirates of the Caribbean | a treasure map poster; a closed treasure chest with coins on the plaza |
| Whiplash / Ratatouille / Office Space | a film-strip poster (plus the snare drum, copper pot and stapler from before) |
| The Green Knight | a knight's-helm poster; a holly wreath on the shop door |
| Daft Punk / Nujabes / Red Hot Chili Peppers | a vinyl poster; a record crate of plain-coloured sleeves; headphones; (turntable upstairs from before) |
| Balatro / Inscryption | a playing-cards poster; dice and chips on the display table (cards and candle upstairs from before) |
| Avatar (Iroh, Zuko, Pai Sho) | a teapot-and-lattice-board poster; a real tea set on the roof table; a lattice board with plain stones on the terrace side table (no lotus tile, no emblem) |
| Jaguar E-Type / Suzuki Sambar / Mario Kart | three small generic toys on the display table: a green long-hood roadster, a white mini flatbed truck, a red go-kart. They are NOT those vehicles |
| Franz Kafka | a horned beetle on a plinth (the novella's animal); plain books on the shelves |
| Moneyball | a stack of plain hardbacks topped with a baseball |
| Swedish Chef | a chef's toque on the display table |
| Bulls / Yankees / Juventus / Barcelona / football and basketball in general | club-coloured striped scarves on the terrace rail, a swag of plain pennants, the shirts upstairs (all plain stripes, no crests) |
| Wii / DS / Xbox / PS2 | the retro gaming corner in the shop window |

Where they live: the **poster column** (twelve text-free posters on one wrapped sheet) stands in the back-right corner of the
plaza; the **sidewalk display table**, **record crate** and **chest** are in front of the left window; scarves, pennants and
shields hang on the front terrace rail; the wreath is on the shop door; the tea set is on the roof table.

## Still not drawn (needs a protected character, logo, product design or weapon)
Team crests and wordmarks, Snorlax, Sableye, Infernape, Tigger, Tai Lung, Anakin / Star Wars, Akira's bike, the real Jaguar
and Suzuki designs, Minecraft, Cuphead, Battlefront, Regular Show, Game of Thrones, the knife from 12 Angry Men, album and
book covers. If you want any of these, send your own artwork or a photo you have the right to use: it goes into a frame,
a poster slot on the column, or a pennant.

## Checks run
- Floating-part audit: 0 unsupported pieces at 1.2 cm (2,313 solid parts).
- Clip audit: the same 10 old HVAC bracket arms as before; no new candidates.
- Interior bounds: 0 interior meshes outside their room (295 checked).
- Stub-typed `tsc`: clean. Click targets: Projects, About me and Resume still reachable; the vending machine and arcade are
  behind the building from the home view, as before.
- Close-up renders from several angles: flag (two views), monkey (three), TV window (three), column (three), display table,
  chest and crate, rail (two), wreath, tea set, lattice board, hoop, plus the home view.

## Where things are in the code
Everything new is in the "END GAME, round two" block of `world.ts` (poster sheet, column, display table, small figures) and in
`endgameWorld` / `endgameExterior` / `endgameInteriors`. Delete a call there to remove an item.
