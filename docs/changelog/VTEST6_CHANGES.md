# vtest6: a bookshelf, and one book per project

Changed files: `index.html`, `src/main.ts`, `src/content.ts`, `src/book.ts` (rewritten), `src/style.css` (book block replaced).

## What changed
1. **"Explore the space" button removed** from the intro. The mobile "EXPLORE ↑" button is the mobile navigation toggle, not the same control, and stays.
2. **Projects is now a bookshelf.** Opening it shows 11 spines on two wooden shelves. Picking one lifts that book off the shelf, flies it to the centre, opens its cover and shows its first spread. There is no flipping from project to project any more; "← Shelf" puts the book back.
3. **Each project is its own short book** (up to four spreads, empty ones are skipped):

| Spread | Left page | Right page |
|---|---|---|
| Overview | title, tagline, headline numbers, tool chips, the question | what the project is, the data |
| Method | the steps | details worth knowing |
| Results | charts | findings |
| Limits | limits and lessons | next steps, files, GitHub link |

   A chapter bar lets you jump between spreads. The Engineering volume has two spreads because it has no README.
4. **Smoother motion.** Page turns lift and curl over the spine with a moving shade and cast shadow (0.95 s); the cover swings open and closed; the spine-to-centre move is a measured fly (0.72 s). Below 751 px, and with reduced motion, these become short cross-fades.
5. **Type fits the page.** Each book picks the largest size at which all of its spreads fit without scrolling, so pages are filled rather than ragged.

## Content rules
All text and numbers come from each project's public README (or from `content.ts` before this change). Nothing is invented. The earlier memory note of an All-Star accuracy of about 0.949 is not in the README and is not shown. The Engineering book uses only the eight listed works, the tools list and the work history already stated for the site.

## Accessibility
Shelf and book are labelled regions; spines are buttons; arrow keys / Home / End move between spines on the shelf and flip pages in a book; Esc and "Hide" behave as before; the hidden view is `inert`; a live region announces the book and spread; charts are real lists and tables.

## Verification status (honest)
- Type-checked with a stub-typed `tsc` (exit 0). The real `npm run build` and the Vercel result have **not** been seen.
- Checked in a software-rendered headless browser: 42 spreads show no overflow at 1500×850, 1920×945, 1366×768, 1280×720 and 1100×800; shelf, pick, flip, close and keyboard flow tested; narrow (390×844) and 900×1000 layouts viewed.
- Not checked: motion on a real GPU, a real phone, a screen reader, the full 3D scene behind the panel.
- At 1280×720 the smallest text is about 10 px.
