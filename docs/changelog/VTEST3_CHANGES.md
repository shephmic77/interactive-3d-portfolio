# vtest3: cleared the circled items, and the decor / missing-items lists

Changed file: `src/world.ts` only.

## Removed in this round (everything you circled)
| Item | Where it was |
|---|---|
| Surfboard | left wall |
| Chalk-bag bench | back, beside the crash pad (the pad and shoes stay) |
| Lattice board | terrace side table (the table stays) |
| Basketball hoop and ball | front-right plaza |
| Pop-up goal, soccer ball, two cones | front-right plaza |
| Table-tennis table | back-left plaza |
| Guatemalan-style flag and mast | roof, beside the tank |
| Striped scarves, pennant swag, three round shields | front terrace rail |
| Fox poster column | back-right plaza |
| Sidewalk display table with all its figures, record crate, treasure chest | in front of the left window |
| Holly wreath | shop door |
| CRT TV, its cabinet, two consoles, handheld, gamepad | right shop window |
| Three framed shirts ("1", "2", "10") | upper floor, back wall |
| Terrace-door lantern and the wall sconce beside it | right side of the upper block |

The code for the plaza and decor pieces is still in `world.ts`, unplaced, so each one can come back with a single line.
The TV corner, the framed shirts and the chalk-bag bench were deleted outright (they are in the previous commit).

## What is left (decor and knick-knacks)
**Plaza and street:** book cart (Projects), resume stand, corkboard (About me), vending machine and arcade at the back,
blank blade sign on a pole, lamp posts, corner bollards, red wagon with a cardboard box, heron statue, potted trees,
pavement drain grate.
**Front of the shop:** striped awning and "The Little Studio" sign, wall lanterns, entrance bench with baseball glove, ball and bat,
a waiting chair, two wooden crates, door pots, doormat.
**Bouldering side:** wall to the roof with coloured holds and two volumes, monkey, crash pad, red climbing shoes, grab bar on the roof.
**Terraces and roof:** bistro table with lantern, two chairs, the cat, lounge bench, side table and chair, string bulbs on two poles,
window-box planters, pots, ivy, water tank, antenna, HVAC units, vents, electrical boxes, downspouts, roof table with lantern and tea set,
roof chairs, quetzal on the front rail,.
**Inside, ground floor:** shop counter with copper pot and spoon, snare drum and sticks, red stapler; bookshelf; table and stools; plant;
pendant lamps; red toy seaplane on cords.
**Inside, upper floor:** sofa, bookshelf, floor lamp, rug, low table with playing cards, candle and two paperbacks; turntable with two
speakers; soccer ball; pendant lamp.

## Asked for but not in the scene
**Placed before, removed this round (generic stand-ins, can return):** Guatemala flag; Surf's Up surfboard; the twelve posters
(Blue Prince, Surf's Up, Vinland Saga, Smite, whodunit, Fantastic Mr. Fox, Pirates, film strip, Green Knight, vinyl, cards, Avatar tea
and lattice); toy vehicles (Jaguar / Suzuki / Mario Kart stand-ins); fox figurine; Kafka beetle; Moneyball books and baseball; Swedish
Chef toque; headphones; dice and chips; record crate; treasure chest; scarves, pennants and shields (club colours, Vinland Saga);
holly wreath (Green Knight); lattice board (Pai Sho); basketball hoop (Bulls, Rose, Dirk); soccer goal, ball and cones (Juventus,
Barcelona, FIFA Street); table-tennis table (Ping Pong the Animation); retro gaming corner (Wii, DS, Xbox, PS2, Battlefront);
framed shirts (basketball, baseball, football); chalk-bag bench.
**Never drawn (protected character, logo, product design or weapon):** team crests, Snorlax, Sableye, Infernape, Tigger, Tai Lung,
Anakin / Star Wars, Akira's bike, real Jaguar and Suzuki designs, Minecraft, Cuphead, Battlefront, Regular Show, Game of Thrones,
the 12 Angry Men knife, album and book covers.
**Still in the scene from your list:** bouldering, monkey, cat, quetzal, Porco Rosso seaplane, heron, Calvin and Hobbes wagon,
turntable and speakers, playing cards and candle, snare drum, copper pot and stapler, baseball glove and bat, tea set.

## Checks
Stub-typed `tsc` clean; floating-part audit 0 unsupported parts (1,985 solid nodes); clip audit unchanged; interior bounds 0 outside.
Close-up renders of the front, the right window, the terrace, the back wall and the roof. Not a real Vite build or a GPU render.
