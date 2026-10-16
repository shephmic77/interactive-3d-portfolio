# vtest20: about half as many holds, none over the wall's edge

Changed file: `src/world.ts`.

- **About half as many holds.** The gold V4-5 problem keeps all eight hand holds but has four foot chips instead of eight. The coral warm-up, the cyan and pink problems and the loose foot chips are thinned out.
- **Nothing clips the side of the panel.** The four hold columns are now 18 cm apart (inside the panel) instead of 20 cm, and any hold whose footprint would cross the edge trim is shrunk a little and slid inward. The same goes for the grade tags and the tape under the finish hold.

Kept: the V4-5 problem, the hold types, the volumes, the monkey and the lamps. The grade tags are decoration, not real grades.

Not verified: no real `npm run build`, Vercel deploy or phone test; only the stub-typed `tsc` check and software renders.
