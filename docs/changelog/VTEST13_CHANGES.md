# vtest13: book cart rebuilt as a wooden bookcase with rounded spines

Changed file: `src/world.ts` (the `bookCart` function and a few small helpers next to it).

**Book cart (Projects)**
- The cart is now a small wooden **bookcase on casters**: dark walnut frame, plum back panel with a warm wash and two thin strip lights, a closed cabinet with two doors at the bottom, and brass plates on the shelf fronts ("DATA SCIENCE & ML", "SOFTWARE & AI · HARDWARE · ENGINEERING"). This echoes the shelf on the Projects page.
- The books are **spine out**, like the zoom-in shelf: dark tinted leather in each project's colour, gold bands top and bottom, the volume number, a small gold diamond and the title running down the spine. Same order and grouping as the page: seven data-science volumes on the upper shelf, then software, hardware and engineering below with gaps between the groups.
- **Less blocky:** each book has a rounded spine, thin boards that stand slightly proud of the page block, and cream page edges showing at the top. Heights and thicknesses vary, with a little hand-placed yaw, and a small brass bookend at each end of a row.
- The neon "PROJECTS / THE BOOK CART" sign moved from the front of the lower shelf (where it covered most of the bottom row) up to a header board on top of the case. The sign texture itself is unchanged.
- Hover and click are unchanged: each book is its own target (label "Open <project>") and the rest of the case is "Browse projects". Checked in a headless render by hovering seven of the books and the frame.

**Side effects to know about**
- The case is a bit taller (about 2.85 against 2.45 before) and 0.07 wider, so it hides slightly more of the pickup truck behind it from the default view.

**Not verified**
- No real `npm run build`, Vercel deploy or phone test; only the stub-typed `tsc` check and software-rendered screenshots.
