# vtest: boulder wall to the roof, signs removed, title raised, END GAME props

Changed files: `src/world.ts`, `src/style.css`. `main.ts`, `ui.ts`, `content.ts`, `index.html`, `package.json` and
`tsconfig.json` are unchanged from V10.

## Honest status
Checked the same way as V10: the real `world.ts` was rendered with real three.js r180 in headless Chromium (software GL)
and run through my geometry audits plus a stub-typed `tsc`. It was **not** built with your Vite install or seen on a GPU.
Run `npm run dev` and tell me what looks off.

## Your requests
- **Boulder wall now runs from the pavement to the roof**, like a ladder: one tall panel in four stacked sections with
  a bolt-hole grid, a coral route to a finish jug under the roof edge, a cyan problem down the right edge, foot chips,
  two volumes, 2 m height ticks, a lamp either side, a crash pad, climbing shoes, a bench with a chalk bag.
  It stands clear of the terrace slab and roof slab and is held by steel standoffs. The back rail of the terrace and of
  the roof is open where it passes, and a grab bar marks the exit onto the roof. (The disconnect box that used to sit
  across the terrace rail now sits above the condenser.)
- **Neon sign stack removed** (the bottom-right menu already navigates). The cool blue key light that used to spill from
  it stays as moonlit fill; the magenta underglow light was dropped (one fewer real light).
- **Title block moved up** (`.intro` now `top:40%` on desktop and tablet; mobile layout unchanged).

## END GAME (you said "end game", so ENDGAME_ONLY.md is now in play)
Rule I followed: **evoke, do not copy.** Everything is an original generic low-poly object in plain colours. I did not
draw team crests, wordmarks, real characters, mascots, album art or branded vehicles, so the list is only partly
implemented. What IS in:

| Idea from the list | What is in the scene |
|---|---|
| bouldering | the wall, crash pad, chalk bag, climbing shoes; a monkey stopped halfway up ("a monkey") |
| a cat | a black-and-white cat on the left terrace chair, watching the table lantern |
| basketball (Rose, Dirk, bulls) | a kid-height hoop with a basketball on the plaza; a plain red tank "1" in a frame |
| baseball (Ichiro, Jeter, Yankees, Moneyball) | glove, ball and bat on the entrance bench; a plain navy pinstripe jersey "2" in a frame |
| soccer (Juventus, Barcelona, Baggio, Dybala, Buffon, Messi, Bojan, FIFA Street) | pop-up goal, ball and cones on the plaza; a plain black/white striped shirt "10" in a frame; a ball in the living room |
| Guatemala | a Guatemalan-style flag on a mast on the roof, and a quetzal perched on the roof rail |
| Ping Pong the Animation | a table-tennis table with paddles and ball behind the building |
| Calvin and Hobbes | a plain red wagon with a cardboard box (no characters) |
| the heron (The Boy and the Heron) | a grey heron statue on a plinth near the book cart |
| Porco Rosso | a small red toy seaplane hung from the ground-floor ceiling |
| surf's up | a surfboard leaning on the left wall |
| Daft Punk / nujabes / red hot chili peppers (music) | a turntable and two speakers on a sideboard upstairs (no band art) |
| Balatro / Inscryption | a fan of playing cards and a lit candle on the coffee table |
| Ratatouille / Office Space / Whiplash | a copper pot with a spoon, a plain red stapler, a snare drum with sticks on the shop counter |
| Wii / DS / Xbox / PS2 (retro) | a CRT showing a plain two-paddle game and two generic consoles on the shop bookshelf |

Not done on purpose (would need a copyrighted character, logo or product design): Bulls/Yankees/Juventus/Barcelona
crests, Snorlax, Sableye, Infernape, Tigger, Swedish Chef, Tai Lung, Anakin, the Pai Sho tile, Akira's bike, the
E-Type, Suzuki vehicle, Minecraft, Mario Kart, Cuphead, Smite, Blue Prince, Battlefront, Regular Show, Vinland Saga,
Monster, Game of Thrones, Memories of Murder, Knives Out, 12 Angry Men's knife, Fantastic Mr. Fox, Pirates,
Kafka and Moneyball (books are already on the shelves, I did not draw covers), Green Knight. If you want one of these,
the clean route is your own artwork or photo: send me the image and I will put it in a frame or on a poster.

## Checks run
- Floating-part audit: 0 unsupported pieces at 1.2 cm. (It caught items I placed .07 above the counter and a net .025 over
  the table; both fixed.)
- Clip audit: 10 candidates, all pre-existing HVAC bracket arms that go into the wall.
- Interior bounds: every interior mesh is inside its room (0 outside).
- Click targets: Projects, About me, Resume still work from the home view. The vending machine and arcade are hidden
  behind the building from the front by design, as before. (With the sign stack gone, the five-way menu on screen is the
  other route to every section.)
- Rendered looks: home (desktop and phone size), wall in four sections, roof exit, plaza right and left, back, terrace
  cat, surfboard, bench kit, upper room, shop window.

## Tuning notes
- Real point lights: 12 (budget 16).
- Everything new is in two blocks in `world.ts`: `boulderRoute` and the "END GAME" section (`endgameWorld`,
  `endgameExterior`, `endgameInteriors`). Delete a call there to remove an item.
