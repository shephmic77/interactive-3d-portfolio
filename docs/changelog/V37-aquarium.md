# V37: aquarium

## What changed

- **New scene, `src/aquarium.ts`.** A small faceted island on the sea floor, open water, light shafts and drifting diamonds. Everything is built in code from primitives (flat shading, per-face vertex colours), with no model files. `src/main.ts` now builds this scene instead of the night-time building. The old scene, `src/world.ts`, is untouched and simply no longer used, so the building can be brought back by switching one import.
- **One animal per project, in the order and species Michael gave:** FutWAR whale shark, Spotify Playlist Curator zebra shark, Basketball RAG Assistant green sea turtle, Geospatial Agentic Services spotted eagle ray, DS 310 Kaggle Project mahi-mahi, Online Purchase Prediction yellow boxfish, NBA All-Star Prediction red lionfish, Letterboxd Analyzer clown triggerfish, NBA Moneyball ribbon eel, NBA Player Archetypes longhorn cowfish, NBA Team Winning Factors dumbo octopus, Pluto12 Macropad anemone with a clownfish, and the Engineering collection as a school of eight sardines (one per engineering piece).
- **Animals circle the island and swim.** Each has its own radius, height, speed and direction. Bodies bend as they swim; turtle flippers, ray wings, lionfish fins, the octopus bell and ears, the eel, the anemone and the seaweed all move.
- **Click or tap an animal to open its project as a book,** through the existing book viewer (`openBook`), unchanged. The eight sardines each show their engineering piece's name on hover and all open the existing grouped Engineering book. Hover enlarges the animal slightly and shows its name.
- **Zoom and move.** Scroll or pinch to zoom; left-drag orbits; right-drag or two fingers moves the view (limited to the aquarium). Home view is pulled back; mobile starts further back.
- **New book: NBA Team Winning Factors** (`winning` in `src/content.ts`), written only from that repository's README and final report (the three correlations quoted there, the data sources and the limits it states). It had no entry before. Credit lines name the two teammates as the README does.
- **Text that described the old building was updated** in `src/ui.ts` and `index.html`: section titles (the book cart, corkboard, vending machine and arcade are gone), the contact note about the vending machine, the credits copy, the control hint, the page description and the scene's accessible label. Jesse Zhou's inspiration credit was left as it was.
- Panels, the book viewer, the resume, routing and the five navigation items still work; About, Contact, Resume and Credits now open as panels over the aquarium (they have no 3D object any more).

## Placeholders, not decisions

These were needed to make it run and can be changed freely: every animal's size (they follow the project order, largest first), orbit radius/height/speed, swimming style, camera distance and angle, the drag mapping, colours, the island's shape, and how the nav sections relate to the scene.

## What was and was not verified

Done, in a Linux container: bundled with esbuild; stub type-check (the only error is the usual missing `./style.css` declaration, since the stub has no Vite types); software-WebGL renders of the home view and close-ups of every animal; a scripted hover-and-click test that moves a real mouse onto each animal and checks the tooltip and which book opens (see the notes below).

**Not done:** `npm install` and the real `npm run build` could not run here (the container cannot reach the npm registry), so the TypeScript check against the real `@types/three` and the real Vite build have not been run. No Vercel build. No real GPU frame rate or load-time measurement, and no phone test; software rendering says nothing about speed. The old building's verification limits still apply to everything else.

Run `npm install && npm run build && npm run dev` on the Windows machine first and report anything that fails.
